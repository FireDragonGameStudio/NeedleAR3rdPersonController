import { loadConfig } from './config.js';
import fs from 'fs';
import { getPosterPath } from './poster.js';

export const needleMeta = (command, config, userSettings) => {

    // we can check if this is a build
    // const isBuild = command === 'build';

    async function updateConfig() {
        config = await loadConfig();
    }

    if (!userSettings) userSettings = {};

    return {
        // replace meta tags
        name: 'meta-tags',
        transformIndexHtml: {
            enforce: 'pre',
            transform(html, _ctx) {

                html = insertNeedleCredits(html);

                if (userSettings.allowMetaPlugin === false) return [];

                // this is useful to get the latest config exported from editor
                // whenever vite wants to transform the html
                updateConfig();

                // early out of the config is invalid / doesn't contain meta information
                // TODO might be better to handle these edge cases / special cases right from Unity/Blender and not here
                if (!config) return [];

                let meta = config.meta;

                if (!meta) {
                    meta = {};
                    meta.title = config.sceneName;
                }

                if (!meta.image?.length) {
                    const path = getPosterPath();
                    if (fs.existsSync('./' + path))
                        meta.image = path;
                }

                const tags = [];

                let img = meta.image;
                if (img?.length) {
                    // for a regular build the absolutePath is url (since we dont know the deployment target)
                    if (config.absolutePath?.length) {
                        const baseUrl = config.absolutePath;
                        let url = baseUrl + "/" + img;
                        url = removeDuplicateSlashesInUrl(url);
                        // url = appendVersion(url);
                        tags.push({ tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } });
                        tags.push({ tag: 'meta', attrs: { name: 'twitter:image', content: url } });
                        tags.push({ tag: 'meta', attrs: { name: 'og:image', content: url } });
                    }
                }

                if (config.absolutePath?.length) {
                    html = updateUrlMetaTag(html, config.absolutePath);
                }

                if (meta.title?.length) {
                    tags.push({ tag: 'meta', attrs: { name: 'og:title', content: meta.title } });

                    html = html.replace(
                        /<title>(.*?)<\/title>/,
                        `<title>${meta.title}</title>`,
                    );

                    if (userSettings.allowRemoveMetaTags !== false)
                        html = removeMetaTag(html, 'og:title');

                }

                if (meta.description?.length) {
                    tags.push({ tag: 'meta', attrs: { name: 'description', content: meta.description } });
                    tags.push({ tag: 'meta', attrs: { name: 'og:description', content: meta.description } });

                    if (userSettings.allowRemoveMetaTags !== false) {
                        html = removeMetaTag(html, 'description');
                        html = removeMetaTag(html, 'og:description');
                    }
                }

                return { html, tags }
            },
        }
    }
}

function updateUrlMetaTag(html, url) {
    html = html.replace(`<meta name="url" content="http://needle.tools">`, `<meta name="url" content="${url}">`);
    return html;
}

function appendVersion(str) {
    return str + "?v=" + Date.now();
}

function removeDuplicateSlashesInUrl(url) {
    return url.replace(/([^:]\/)\/+/g, "$1");
}

function removeMetaTag(html, name) {
    // TODO: maybe we could also just replace the content
    const regex = new RegExp(`<meta (name|property)="${name}".+?\/?>`, 'gs');
    const newHtml = html.replace(
        regex,
        '',
    );
    // console.log(newHtml);
    return newHtml;
}

function insertNeedleCredits(html) {
    const needleCredits = `<!-- 🌵 Made with Needle — https://needle.tools -->`;
    html = html.replace(
        /<head>/,
        needleCredits + "\n<head>",
    );
    return html;
}