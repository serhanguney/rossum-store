const nodeFetch = require('node-fetch');

const invokeIntegration = async ({ body, baseUrl, integrationId, token }) => {
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

const updateExtensions = async ({ form, token, baseUrl }) => {
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
      nodeFetch(`${baseUrl}/api/v1/hooks/${extension.extensionId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...extension.data,
          extension_source: 'custom',
          metadata: {
            upstream: {
              version: extension.latestVersion,
              extension_id: extension.extensionKey,
              integration_id: extension.integration_id,
            },
          },
        }),
      }).then((res) => res.json())
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

exports.rossum_hook_request_handler = async ({
  rossum_authorization_token,
  base_url,
  hook,
  form,
}) => {
  if (form)
    return await updateExtensions({
      form,
      token: rossum_authorization_token,
      baseUrl: base_url,
    });

  const allExtensions = await nodeFetch(`${base_url}/api/v1/hooks`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${rossum_authorization_token}`,
    },
  }).then((res) => res.json());

  const versionedExtensions = allExtensions.results.filter(
    (ext) => !!ext.metadata.upstream
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

  const outdatedExtensions = versionsToUpdate.flatMap(
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
          message: 'Everything is up to date!',
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
