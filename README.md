# Rossum store template

> **Warning**
> This is an internal proposal and should not be used on any production setups.

This is a monorepo example that can be used for filling custom extensions into Rossum store. It is based on `rossum-store-webhook` that turns git repository into a rossum webhook store integration. This whole guide will suppose that you have this webhook installed in your Rossum organization and this repository added as a source. 

## Adding extensions

You can add hook template to the `dist` folder, see the example `dist/kitten` folder. It contains a `meta.json`, which is similar to a hook template object. Instead of `config.code`, you can use `config.code_source`, which is a relative path to a file with the hook template code. 

## Adding extension image 

In `meta.json`, you can set a preview image for your extension in the `extension_image_url` property. Furthermore, if you are using Github, you can use it as your CDN by enabling Github pages on your repository. 

## Adding extension versions 

Once you push this to `main` branch, you will see a pretty new tile with your extension in Rossum store. However, you will not be able to install it yet, because it has no versions. This is done by pushing a tag. For an extension in `dist/kitten` folder, it will be `ext/kitten/v0.0.1`. 

This can be automated with Github actions, as you can see in the `.github/workflows` folder. You should create an action for each extension. Make sure you enable `Read and write permissions` for Workflow permissions so that the actions can create the tag.

## Testing extensions locally from VS Code (work in progress)

If you are using VS Code, you can run your node extensions locally. Open an extension file (for example, any code in `dist/kitten/`), and press `Run > Run without debugging`. You have to have node installed on your computer. This will run `exports.rossum_hook_request_handler` and returns the response of this function.

Additionally, it can display front-end intents in the Rossum UI. However, you will need to install a couple of libraries for that: 

```
npm install dotenv
npm install puppeteer
```

and, additionally, set a local front-end in `.env` file. This will run the intent on the specified front-end.