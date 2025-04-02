exports.rossum_hook_request_handler = async () => {
  const response = await fetch("https://cataas.com/cat")
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');

  return {
    intent: {
      form: {
        schema: {},
        uiSchema: {
          type: 'VerticalLayout',
          elements: [{
            type: 'Image',
            src: `data:image/jpg;base64,${base64}`,
            text: 'Figure 1.2: Random kitten'
          }, ],
        }
      }
    }
  };
};
