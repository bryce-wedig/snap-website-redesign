import { defineConfig } from 'astro/config';

import mdx from '@astrojs/mdx';

const base = '/snap-website-redesign/';

/**
 * Remark plugin that rewrites absolute-root-relative *link* paths in content
 * (e.g. /initiatives/...) to include the deployment base path.
 *
 * Images are deliberately not handled here. They are referenced with paths
 * relative to the file (../../assets/images/...), which Astro's asset pipeline
 * resolves, optimizes, and fingerprints itself — rebasing them would break that.
 * A content image must therefore live under src/assets/images/, not public/.
 *
 * To switch to the custom domain, remove the `base` option from defineConfig and
 * delete this plugin — link paths starting with "/" will work as-is.
 */
function remarkRebasePaths() {
  function rebase(path) {
    if (typeof path === 'string' && path.startsWith('/') && !path.startsWith('//')) {
      return base + path.slice(1);
    }
    return path;
  }

  function walk(node) {
    // Markdown link: [text](/initiatives/...)
    if (node.type === 'link') {
      node.url = rebase(node.url);
    }
    // Raw inline HTML: <a href="/...">
    if (node.type === 'html') {
      node.value = node.value.replace(
        /href="(\/[^/"][^"]*)"/g,
        (_, path) => `href="${rebase(path)}"`
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

  integrations: [mdx()]
});
