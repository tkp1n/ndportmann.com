---
title: Convert Markdown to HTML in an Angular app
category: "webdev"
cover: pankaj-patel-u2Ru4QBXA5Q-unsplash.jpg
author: nicolas portmann
---

Converting Markdown with code fragments to HTML on the client (Angular) can be done in under 50 LoC. This blog post guides you through it.

We start by installing three dependencies (what would web dev be without some tasty npm packages 😂):

* *marked* (0.7.0) will transform most of the Markdown input to HTML
* *highlight.js* (9.15.8) applies beautiful nice highlighting to the code fragments within the Markdown
* *DOMpurify* (1.0.11) helps to keep things secure to avoid [XSS attack surface](https://angular.io/guide/security#xss)

```bash
npm install marked highlight.js dompurify
```

To make our code snippets look pretty, we need to choose a CSS file from *highlight.js*. This [demo page](https://highlightjs.org/static/demo/) showcases all available designs (and supported languages for that matter).
The selected style can be applied, by including the CSS file to the Angular project, e.g., by adding the following to the `style` section of the `angular.json` configuration file.

```json
...
"styles": [
    "src/styles.css",
    "./node_modules/highlight.js/styles/dracula.css"
],
...
```

The following component, named `markdown.component.ts` does most of the heavy-lifting for you. The constructor defines a custom *marked* `Renderer` with a callback for handling the code snippets. `highlightCode` delegates to *highlight.js* to do the actual formatting of the code (using markdown as default, should *highlight.js* not know your language). `markdownToSafeHtml` is called by `ngOnChanges` if the markdown input changes and uses the previously defined marked instance and DOMPurify to convert the new value into `SafeHtml` which can be used directly as `[innerHTML]` in the template of the component.

```typescript
import marked, { Renderer } from 'marked';
import highlightjs from 'highlight.js';
import DOMPurify from 'dompurify';

import {
    Component, Input, OnChanges, SimpleChange, ViewEncapsulation
} from '@angular/core';
import {
    DomSanitizer, SafeHtml
} from '@angular/platform-browser';

@Component({
    selector: 'markdown',
    template: '<pre [innerHTML]="data"></pre>',
    encapsulation: ViewEncapsulation.None
})
export class MarkdownComponent implements OnChanges {

    @Input() text: string;
    data: SafeHtml;
    md: any;

    static highlightCode(code: string, language: string): string {
        if (!(language && highlightjs.getLanguage(language))) {
             // use 'markdown' as default language
            language = 'markdown';
        }

        const result = highlightjs.highlight(language, code).value;
        return `<code class="hljs ${language}">${result}</code>`;
    }

    constructor(private sanitizer: DomSanitizer) {
        const renderer = new Renderer();
        renderer.code = MarkdownComponent.highlightCode;
        this.md = marked.setOptions({ renderer });
    }

    markdownToSafeHtml(value: string): SafeHtml {
        const html = this.md(value);
        const safeHtml = DOMPurify.sanitize(html);
        return this.sanitizer.bypassSecurityTrustHtml(safeHtml);
    }

    ngOnChanges(changes: { [propKey: string]: SimpleChange }) {
        for (const propName in changes) {
            if (propName === 'text') {
                const value = changes[propName].currentValue;
                if (value) {
                    this.data = this.markdownToSafeHtml(value);
                }
            }
        }
    }
}
```

The last step would then be to add the component to the `declarations` of the app module:

```json
...
  declarations: [
    AppComponent,
    MarkdownComponent
  ]
...
```

It can then be used in any other component as follows:

```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: '<markdown [text]=md></markdown>'
})
export class AppComponent {
  md = '# Hello Markdown\n```csharp\npublic class Foo {}\n```';
}
```

> The full demo project is available on [GitHub](https://github.com/tkp1n/md2html).
