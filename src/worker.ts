/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { convertRule } from './utils/convert-rule';
import { parse, stringify } from 'yaml';

const ruleSlotName = 'ruleSlot';

// Export a default object containing event handlers
export default {
  // The fetch handler is invoked when this worker receives a HTTP(S) request
  // and should return a Response (optionally wrapped in a Promise)
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // You'll find it helpful to parse the request.url string into a URL object. Learn more at https://developer.mozilla.org/en-US/docs/Web/API/URL
    const url = new URL(request.url);
    const baseConfigUrl = url.searchParams.get('base');
    const sourceUrl = url.searchParams.get('src') || 'https://raw.githubusercontent.com/gfwlist/gfwlist/master/gfwlist.txt';

    if (!baseConfigUrl) {
      return getHelloPage();
    }

    const baseConfigResponse = await fetch(baseConfigUrl).then(res => res.text()).catch(e => getErrorPage(`requesting base config (${baseConfigUrl})`, e.toString()));
    if (baseConfigResponse instanceof Response) return baseConfigResponse;
    const sourceResponse = await fetch(sourceUrl).then(res => res.text()).catch(e => getErrorPage(`requesting gfwlist (${sourceUrl})`, e.toString()));
    if (sourceResponse instanceof Response) return sourceResponse;
    const convertedSource = convertRule(sourceResponse);

    let parsedBaseConfig: any;
    try {
      parsedBaseConfig = parse(baseConfigResponse);
    } catch (e) {
      return getErrorPage(`parsing base config (${baseConfigUrl})`, JSON.stringify(e));
    }

    const slotIndex = parsedBaseConfig?.rules?.findIndex((el: string) => el === ruleSlotName);

    if (slotIndex === undefined || slotIndex === -1) {
      return getErrorPage(`finding slot base in config (${baseConfigUrl})`, `base config must contain an item in "rules" called "${ruleSlotName}".`);
    }

    parsedBaseConfig.rules = parsedBaseConfig.rules.splice(slotIndex, 1, ...convertedSource);

    return new Response(
      stringify(parsedBaseConfig),
      { headers: { 'Content-Type': 'text/vnd.yaml' } }
    );
  }
};

const getHelloPage = () => {
  return new Response(
    `
    <div class='container'>
        <div>
          <pre>missing required arguments: base</pre>
          <pre>valid arguments:</pre>
          <pre>base *[url] base config file you want to merge in. it must contain an item in "rules" called "ruleSlot".</pre>
          <pre>src   [url] gfwlist source. default: github</pre>
        </div>
    </div>
    <style>
      body {
        margin: 0;
        background: #012;
        color: #eee;
        font-family: monospace;
        font-size: 16px;
      }
      pre {
        white-space: pre-wrap;
      }
      .container {
        margin: 1em;
        display: flex;
        align-items: center;
      }
    </style>
`,
    { headers: { 'Content-Type': 'text/html' } }
  );
};

const getErrorPage = (doing: string, error: string) => {
  return new Response(
    `
    <div class='container'>
        <div>
          <pre>we have encountered a problem while ${doing}.</pre>
          <pre>${error}</pre>
        </div>
    </div>
    <style>
      body {
        margin: 0;
        background: #012;
        color: #eee;
        font-family: monospace;
        font-size: 16px;
      }
      pre {
        white-space: pre-wrap;
      }
      .container {
        margin: 1em;
        display: flex;
        align-items: center;
      }
    </style>
`,
    { headers: { 'Content-Type': 'text/html' } }
  );
};
