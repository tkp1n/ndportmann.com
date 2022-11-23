const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");
const { parse } = require('node-html-parser');
const Image = require("@11ty/eleventy-img");
const CleanCSS = require("clean-css");

async function imageShortcode(src, alt, sizes) {
  let metadata = await Image(src, {
    widths: [300, 600, null],
    formats: ["avif", "webp", "jpeg"],
    outputDir: "./_site/img/"
  });

  let imageAttributes = {
    alt,
    sizes,
    loading: "lazy",
    decoding: "async",
  };

  return Image.generateHTML(metadata, imageAttributes);
}

module.exports = function (eleventyConfig) {
  eleventyConfig.addPlugin(syntaxHighlight);
  eleventyConfig.addNunjucksAsyncShortcode("image", imageShortcode);
  eleventyConfig.setTemplateFormats([
    "njk",
    "md",
    "css"
  ]);
  
  eleventyConfig.addPassthroughCopy({
    "node_modules/prismjs/themes/prism-okaidia.min.css": "prism-okaidia.min.css"
  });
  eleventyConfig.addPassthroughCopy({
    "node_modules/katex/dist/katex.min.css": "katex.min.css"
  });
  eleventyConfig.addPassthroughCopy({
    "node_modules/katex/dist/fonts": "fonts"
  });

  const md = require("markdown-it")();
  md.use(require("markdown-it-katex"));
  md.use(require('markdown-it-multimd-table'), {
    multiline:  true,
    rowspan:    true,
    headerless: false,
    multibody:  false,
    autolabel:  false,
  });

  eleventyConfig.setLibrary("md", md);

  eleventyConfig.addFilter("cssmin", function(code) {
    return new CleanCSS({}).minify(code).styles;
  });

  // return directory of file
  eleventyConfig.addNunjucksFilter("dir", function(value) { 
    return require('path').dirname(value);
  });

  // generate URL from post folder name
  eleventyConfig.addNunjucksFilter("postUrl", function(value) {
    const dir = require('path').dirname(value);
    const folder = dir.split('/').slice(-1)[0];
    const url = folder.split('--').slice(-1)[0];

    return url;
  });

  // extract date from post folder name
  eleventyConfig.addNunjucksFilter("postDate", function(value) {
    const dir = require('path').dirname(value);
    const folder = dir.split('/').slice(-1)[0];
    const date = folder.split('--')[0];

    return date.replace(/-/g, '/');
  });

  // generate <picture> data for image referenced in markdown files
  eleventyConfig.addTransform("md-img", async function(content) {
    const outputPath = this.outputPath;
    const inputPath = this.inputPath;

    if( outputPath && outputPath.endsWith(".html") ) {
      const root = parse(content);
      const images = root.querySelectorAll('img');

      const sourceDir = require('path').dirname(inputPath);

      for (const image of images) {
        const src = image.getAttribute('src');
        const alt = image.getAttribute('alt');

        if (src.startsWith('/img/')) {
          continue;
        }
        if (!src.endsWith('jpg') && !src.endsWith('jpeg')) {
          continue;
        }

        const srcPath = require('path').join(sourceDir, src);

        const metadata = await Image(srcPath, {
          widths: [300, 600, null],
          formats: ["avif", "webp", "jpeg"],
          outputDir: "./_site/img/"
        });

        const imageAttributes = {
          alt,
          sizes: '766px',
          loading: "lazy",
          decoding: "async",
        };

        image.replaceWith(Image.generateHTML(metadata, imageAttributes));
      }
      
      return `<!DOCTYPE html>${root.outerHTML}`
    }

    return content;
  });
};