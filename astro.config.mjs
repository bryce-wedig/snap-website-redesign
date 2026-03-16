import { defineConfig } from 'astro/config';

const base = '/snap-website-redesign/';

/**
 * Remark plugin that rewrites absolute-root-relative paths in markdown content
 * (image src, link href, and raw inline HTML) to include the deployment base path.
 * This handles paths like /images/... and /initiatives/... in both markdown syntax
 * and inline <img>/<a> HTML blocks.
 *
 * To switch to the custom domain, remove the `base` option from defineConfig and
 * delete this plugin — markdown paths starting with "/" will work as-is.
 */
function remarkRebasePaths() {
  function rebase(path) {
    if (typeof path === 'string' && path.startsWith('/') && !path.startsWith('//')) {
      return base + path.slice(1);
    }
    return path;
  }

  function walk(node) {
    // Markdown image: ![alt](/images/...)
    if (node.type === 'image') {
      node.url = rebase(node.url);
    }
    // Markdown link: [text](/initiatives/...)
    if (node.type === 'link') {
      node.url = rebase(node.url);
    }
    // Raw inline HTML: <img src="/images/..." /> or <a href="/...">
    if (node.type === 'html') {
      node.value = node.value.replace(
        /(src|href)="(\/[^/"][^"]*)"/g,
        (_, attr, path) => `${attr}="${rebase(path)}"`
      );
    }
    if (node.children) node.children.forEach(walk);
  }

  return function (tree) { walk(tree); };
}

export default defineConfig({
  site: 'https://bryce-wedig.github.io',
  base,
  trailingSlash: 'always',
  output: 'static',
  markdown: {
    remarkPlugins: [remarkRebasePaths],
    shikiConfig: {
      theme: 'github-light',
    },
  },
  vite: {
    css: {
      postcss: {
        plugins: [],
      },
    },
  },
});
