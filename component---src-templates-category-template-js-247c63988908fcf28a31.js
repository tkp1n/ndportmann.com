(window.webpackJsonp=window.webpackJsonp||[]).push([[6],{294:function(e,t,a){"use strict";a.r(t),a.d(t,"categoryQuery",function(){return y});var n=a(28),c=a(1),i=a.n(c),s=a(0),r=a.n(s),l=a(301),o=a(152),m=a(303),d=a(302),p=a(311),u=function(e){var t=e.pageContext.category,a=e.data.allMarkdownRemark,c=a.totalCount,i=a.edges;return r.a.createElement(r.a.Fragment,null,r.a.createElement(o.ThemeContext.Consumer,null,function(e){return r.a.createElement(m.a,{theme:e},r.a.createElement("header",null,r.a.createElement(d.a,{theme:e},r.a.createElement("span",null,"Posts in category")," ",r.a.createElement(n.g,null),t),r.a.createElement("p",{className:"meta"},"There ",c>1?"are":"is"," ",r.a.createElement("strong",null,c)," post",c>1?"s":""," in the category."),r.a.createElement(p.a,{edges:i,theme:e})))}),r.a.createElement(l.a,null))};u.propTypes={data:i.a.object.isRequired,pageContext:i.a.object.isRequired},t.default=u;var y="3772081990"},301:function(e,t,a){"use strict";var n=a(0),c=a.n(n),i=a(1),s=a.n(i),r=a(304),l=a.n(r),o=a(29),m=a.n(o),d=function(e){var t=e.data,a=((t||{}).frontmatter||{}).title,n=((t||{}).frontmatter||{}).description,i=((t||{}).frontmatter||{}).cover,s=((t||{}).fields||{}).slug,r=a?a+" - "+m.a.shortSiteTitle:m.a.siteTitle,o=n||m.a.siteDescription,d=i?m.a.siteUrl+i.childImageSharp.resize.src:m.a.siteUrl+"/"+m.a.siteImage,p=s?m.a.siteUrl+s:"undefined"!=typeof window?m.a.siteUrl+window.location.pathname:m.a.siteUrl;return c.a.createElement(l.a,{htmlAttributes:{lang:m.a.siteLanguage,prefix:"og: http://ogp.me/ns#"}},c.a.createElement("title",null,r),c.a.createElement("meta",{name:"description",content:o}),c.a.createElement("meta",{property:"og:url",content:p}),c.a.createElement("meta",{property:"og:title",content:r}),c.a.createElement("meta",{property:"og:description",content:o}),c.a.createElement("meta",{property:"og:image",content:d}),c.a.createElement("meta",{property:"og:type",content:"website"}),c.a.createElement("meta",{name:"twitter:card",content:"summary"}),c.a.createElement("meta",{name:"twitter:creator",content:m.a.authorTwitterAccount?m.a.authorTwitterAccount:""}))};d.propTypes={data:s.a.object};var p=d;a.d(t,"a",function(){return p})},302:function(e,t,a){"use strict";var n=a(2),c=a.n(n),i=a(0),s=a.n(i),r=a(1),l=a.n(r),o=function(e){var t=e.title,a=e.children,n=e.theme;return s.a.createElement(s.a.Fragment,null,t?s.a.createElement("h1",{className:c.a.dynamic([["1826841480",[n.font.size.xxl,n.space.stack.l,n.time.duration.long,n.font.weight.standard,n.space.stack.xs,n.color.brand.primary,"calc("+n.font.size.xl+" * 1.2)","calc("+n.font.size.xl+" * 1.4)"]]])},t):s.a.createElement("h1",{className:c.a.dynamic([["1826841480",[n.font.size.xxl,n.space.stack.l,n.time.duration.long,n.font.weight.standard,n.space.stack.xs,n.color.brand.primary,"calc("+n.font.size.xl+" * 1.2)","calc("+n.font.size.xl+" * 1.4)"]]])},a),s.a.createElement(c.a,{styleId:"1826841480",css:["h1.__jsx-style-dynamic-selector{font-size:"+n.font.size.xxl+";margin:"+n.space.stack.l+";-webkit-animation-name:headlineEntry;-webkit-animation-name:headlineEntry-__jsx-style-dynamic-selector;animation-name:headlineEntry-__jsx-style-dynamic-selector;-webkit-animation-duration:"+n.time.duration.long+";-webkit-animation-duration:"+n.time.duration.long+";animation-duration:"+n.time.duration.long+";}","h1.__jsx-style-dynamic-selector span{font-weight:"+n.font.weight.standard+";display:block;font-size:0.5em;-webkit-letter-spacing:0;-moz-letter-spacing:0;-ms-letter-spacing:0;letter-spacing:0;margin:"+n.space.stack.xs+";}","h1.__jsx-style-dynamic-selector svg{height:0.75em;fill:"+n.color.brand.primary+";}","@-webkit-keyframes headlineEntry{from.__jsx-style-dynamic-selector{opacity:0.5;}to.__jsx-style-dynamic-selector{opacity:1;}}","@-webkit-keyframes headlineEntry-__jsx-style-dynamic-selector{from{opacity:0.5;}to{opacity:1;}}","@keyframes headlineEntry-__jsx-style-dynamic-selector{from{opacity:0.5;}to{opacity:1;}}","@media screen and (min-width:600px){h1.__jsx-style-dynamic-selector{font-size:calc("+n.font.size.xl+" * 1.2);}}","@media screen and (min-width:1024px){h1.__jsx-style-dynamic-selector{font-size:calc("+n.font.size.xl+" * 1.4);}}"],dynamic:[n.font.size.xxl,n.space.stack.l,n.time.duration.long,n.font.weight.standard,n.space.stack.xs,n.color.brand.primary,"calc("+n.font.size.xl+" * 1.2)","calc("+n.font.size.xl+" * 1.4)"]}))};o.propTypes={title:l.a.string,children:l.a.node,theme:l.a.object.isRequired},t.a=o},303:function(e,t,a){"use strict";var n=a(2),c=a.n(n),i=a(0),s=a.n(i),r=a(1),l=a.n(r),o=function(e){var t=e.children,a=e.theme;return s.a.createElement(s.a.Fragment,null,s.a.createElement("article",{className:c.a.dynamic([["2846578189",[a.space.inset.default,"calc("+a.space.default+") calc("+a.space.default+" * 2)",a.text.maxWidth.tablet,"calc("+a.space.default+" * 2 + 90px) 0 calc("+a.space.default+" * 2)",a.text.maxWidth.desktop]]])+" article"},t),s.a.createElement(c.a,{styleId:"2846578189",css:[".article.__jsx-style-dynamic-selector{padding:"+a.space.inset.default+";margin:0 auto;}","@media screen and (min-width:600px){.article.__jsx-style-dynamic-selector{padding:calc("+a.space.default+") calc("+a.space.default+" * 2);max-width:"+a.text.maxWidth.tablet+";}}","@media screen and (min-width:1024px){.article.__jsx-style-dynamic-selector{padding:calc("+a.space.default+" * 2 + 90px) 0 calc("+a.space.default+" * 2);max-width:"+a.text.maxWidth.desktop+";}}"],dynamic:[a.space.inset.default,"calc("+a.space.default+") calc("+a.space.default+" * 2)",a.text.maxWidth.tablet,"calc("+a.space.default+" * 2 + 90px) 0 calc("+a.space.default+" * 2)",a.text.maxWidth.desktop]}))};o.propTypes={children:l.a.node.isRequired,theme:l.a.object.isRequired};var m=o;a.d(t,"a",function(){return m})},311:function(e,t,a){"use strict";var n=a(2),c=a.n(n),i=a(0),s=a.n(i),r=a(1),l=a.n(r),o=a(16),m=function(e){var t=e.edges,a=e.theme;return s.a.createElement(s.a.Fragment,null,s.a.createElement("ul",{className:c.a.dynamic([["132031231",[a.space.stack.m,a.space.m,a.space.xs,a.font.size.s,a.font.lineHeight.l]]])},t.map(function(e){var t=e.node,n=t.frontmatter.title,i=t.fields.slug;return s.a.createElement("li",{key:i,className:c.a.dynamic([["132031231",[a.space.stack.m,a.space.m,a.space.xs,a.font.size.s,a.font.lineHeight.l]]])},s.a.createElement(o.Link,{to:i},n))})),s.a.createElement(c.a,{styleId:"132031231",css:["ul.__jsx-style-dynamic-selector{margin:"+a.space.stack.m+";padding:"+a.space.m+";list-style:circle;}","li.__jsx-style-dynamic-selector{padding:"+a.space.xs+" 0;font-size:"+a.font.size.s+";line-height:"+a.font.lineHeight.l+";}"],dynamic:[a.space.stack.m,a.space.m,a.space.xs,a.font.size.s,a.font.lineHeight.l]}))};m.propTypes={edges:l.a.array.isRequired,theme:l.a.object.isRequired};var d=m;a.d(t,"a",function(){return d})}}]);
//# sourceMappingURL=component---src-templates-category-template-js-247c63988908fcf28a31.js.map