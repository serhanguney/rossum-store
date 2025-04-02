const apiRequest = async (body) => {
  return await fetch('https://r8store-api.fly.dev/webhook', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
  }).then((res) => res.json());
};

const updateExtensions = async ({ form, defaultProps }) => {
  if (!defaultProps.rossum_authorization_token)
    return {
      intent: {
        error: {
          message: 'Token missing',
        },
      },
    };

  const updatedExtensions = await Promise.all(
    form.outdatedExtensions.map((extension) =>
      apiRequest({
        payload: {
          name: 'checkout_extension',
          extension: extension.extensionKey,
          version: extension.latestVersion,
        },
        ...defaultProps,
      }).then((res) => ({
        data: res,
        extensionId: extension.id,
        latestVersion: extension.latestVersion,
        extensionKey: extension.extensionKey,
        store_webhook_id: extension.store_webhook_id,
      }))
    )
  );

  return await Promise.all(
    updatedExtensions.map((extension) =>
      fetch(`${defaultProps.base_url}/api/v1/hooks/${extension.extensionId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${defaultProps.rossum_authorization_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...extension.data,
          extension_source: 'custom',
          metadata: {
            upstream: {
              version: extension.latestVersion,
              ext: extension.extensionKey,
              store_webhook_id: extension.store_webhook_id,
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
  settings,
  secrets,
  hook,
  form,
}) => {
  const defaultProps = {
    rossum_authorization_token,
    base_url,
    settings,
    secrets,
    hook,
  };

  if (form)
    return updateExtensions({
      form,
      defaultProps,
    });

  const customExtensions = await apiRequest({
    payload: {
      name: 'get_extension_list',
    },
    ...defaultProps,
  });

  const extensionNames = Object.values(customExtensions).map((ext) => ext.name);
  const extensionKeys = Object.keys(customExtensions);

  const existingExtensions = await Promise.all(
    extensionNames.map((extensionName) =>
      fetch(
        `${base_url}/api/v1/hooks?name=${encodeURIComponent(extensionName)}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${rossum_authorization_token}`,
          },
        }
      ).then((res) => res.json().then((data) => data.results))
    )
  ).then((result) => result.flat());

  const versionsData = await Promise.all(
    extensionKeys.map((extensionKey) =>
      apiRequest({
        payload: {
          name: 'get_extension_version',
          extension: extensionKey,
        },
        ...defaultProps,
      }).then((versions) => {
        const customExtension = customExtensions[extensionKey];

        return {
          versions,
          extensionName: customExtension?.name,
          extensionKey,
        };
      })
    )
  );

  const outdatedExtensions = versionsData.flatMap(
    ({ versions, extensionName, extensionKey }) => {
      const existingExtension = existingExtensions.find(
        (ext) => ext.name === extensionName
      );
      const latestVersion = versions[0];
      const currentVersion = existingExtension?.metadata?.upstream?.version;

      return existingExtension && latestVersion !== currentVersion
        ? [
            {
              extensionName: existingExtension?.name,
              latestVersion,
              currentVersion,
              extensionKey,
              id: existingExtension.id,
              store_webhook_id:
                existingExtension?.metadata?.upstream?.store_webhook_id,
            },
          ]
        : [];
    }
  );

  if (outdatedExtensions.length === 0)
    return {
      versionsData,
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
