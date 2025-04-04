import nodeFetch from 'node-fetch';
import { createElisClient, endpoints } from '@rossum/api-client';
import { Hook } from '@rossum/api-client/types/src/hooks/models/hook';
import { ListResponse } from '@rossum/api-client/types/src/utils/listResponse';
import {
  Form,
  formSchema,
  isHookWithMetadata,
  OutdatedExtension,
} from './schemas';

type CommonProps = { baseUrl: string; token: string };

type InvokeIntegrationPayload = CommonProps & {
  body: {
    payload: {
      name: 'get_extension_version' | 'checkout_extension';
      extension?: string;
      version?: string;
    };
  };
  integrationId: number;
};
// TODO update fn when api-client is updated
const invokeIntegration = async ({
  body,
  baseUrl,
  integrationId,
  token,
}: InvokeIntegrationPayload) => {
  const url = `${baseUrl}/api/v1/hook_integrations/${integrationId}/invoke`;

  return await nodeFetch(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  }).then((res) => res.json());
};

type UpdateExtensionsProps = CommonProps & {
  form: Form;
  api: ReturnType<typeof createElisClient>;
};

const updateExtensions = async ({
  form,
  token,
  baseUrl,
  api,
}: UpdateExtensionsProps) => {
  if (!token)
    return {
      intent: {
        error: {
          message: 'Token missing',
        },
      },
    };

  const updatedExtensions = await Promise.all(
    form.outdatedExtensions.map((extension) =>
      invokeIntegration({
        body: {
          payload: {
            name: 'checkout_extension',
            extension: extension.extensionKey,
            version: extension.latestVersion,
          },
        },
        baseUrl,
        token,
        integrationId: extension.integration_id,
      }).then((res) => ({
        data: res,
        extensionId: extension.id,
        latestVersion: extension.latestVersion,
        extensionKey: extension.extensionKey,
        integration_id: extension.integration_id,
      }))
    )
  );

  return await Promise.all(
    updatedExtensions.map((extension) =>
      api.request(
        endpoints.hooks.patch(extension.extensionId, {
          ...extension.data,
          extension_source: 'custom',
          metadata: {
            upstream: {
              version: extension.latestVersion,
              extension_id: extension.extensionKey,
              integration_id: extension.integration_id,
            },
          },
        })
      )
    )
  )
    .then((response) => {
      return {
        intent: {
          info: {
            message: 'All extensions are updated.',
          },
          form: null,
        },
        response,
      };
    })
    .catch((e) => ({
      intent: {
        error: {
          message: 'There was an error.',
        },
        form: null,
      },
    }));
};

type ServerlessFnProps = {
  rossum_authorization_token: string;
  base_url: string;
  hook: unknown;
  form: Form;
};

export const rossum_hook_request_handler = async ({
  rossum_authorization_token,
  base_url,
  hook,
  form,
}: ServerlessFnProps) => {
  const api = createElisClient({
    baseUrl: base_url,
    getAuthToken: () => rossum_authorization_token,
  });

  if (form) {
    const parsedForm = formSchema.safeParse(form);
    if (!parsedForm.success) {
      return {
        intent: {
          error: { message: 'The data received in form payload is invalid' },
        },
      };
    }
    return await updateExtensions({
      form: parsedForm.data,
      token: rossum_authorization_token,
      baseUrl: base_url,
      api,
    });
  }

  let allExtensions: ListResponse<Hook> = {
    results: [],
    pagination: { next: null, previous: null, totalPages: 0, total: 0 },
  };
  let error: unknown;
  try {
    allExtensions = await api.request(endpoints.hooks.list());
  } catch (e) {
    error = e;
    console.error('error', e);
    console.warn('error', allExtensions);
  }

  const versionedExtensions = allExtensions.results.flatMap((ext) =>
    isHookWithMetadata(ext) ? [ext] : []
  );

  const versionsToUpdate = await Promise.all(
    versionedExtensions.map((ext) =>
      invokeIntegration({
        body: {
          payload: {
            name: 'get_extension_version',
            extension: ext.metadata.upstream.extension_id,
          },
        },
        token: rossum_authorization_token,
        baseUrl: base_url,
        integrationId: ext.metadata.upstream.integration_id,
      }).then((versions) => ({
        latestVersion: versions[0],
        extension: ext,
      }))
    )
  );

  const outdatedExtensions: Array<OutdatedExtension> = versionsToUpdate.flatMap(
    ({ latestVersion, extension }) => {
      const {
        version: currentVersion,
        integration_id,
        extension_id,
      } = extension.metadata.upstream;

      const isOutdated = currentVersion !== latestVersion;
      return isOutdated && latestVersion
        ? [
            {
              extensionName: extension.name,
              latestVersion,
              currentVersion,
              extensionKey: extension_id,
              id: extension.id,
              integration_id,
            },
          ]
        : [];
    }
  );

  if (outdatedExtensions.length === 0)
    return {
      intent: {
        info: {
          message: error,
        },
      },
    };

  return {
    intent: {
      form: {
        width: 1000,
        hook,
        defaultValue: {
          outdatedExtensions,
        },
        uiSchema: {
          type: 'Group',
          elements: [
            {
              type: 'Table',
              scope: '#/properties/outdatedExtensions',
            },
          ],
        },
      },
    },
  };
};
