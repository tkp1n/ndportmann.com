---
title: Passing Context with Spring WebFlux (Part I)
category: "Java"
cover: rawpixel-678089-unsplash.jpg
author: nicolas portmann
---

With traditional Jakarta EE (Java EE) or Spring projects, we utilize [MDCs (Mapped Diagnostic Context)](https://logback.qos.ch/manual/mdc.html) - a feature from SLF4J - to enrich logs with contextual data. Such contextual data might include but is not limited to the following:

- Request ID,
- DNS name of the hardware involved in processing the request,
- The ID of the client initiating the request

In a microservices environment, this information is then typically passed to all services involved in handling a specific client request. Although [deprecated](https://tools.ietf.org/html/rfc6648) we examine, how to best pass context information between services as HTTP non-standard `X-` headers. We also investigate in the second part of this post, how to use constructs such as MDCs in a reactive environment, where `ThreadLocal`s cannot be used to store context. 

The solution to the latter is a variation of [this excellent idea by Simon Basle](https://simonbasle.github.io/2018/02/contextual-logging-with-reactor-context-and-mdc/). I suggest you skim over it before reading the second part, a link to which you can find at the very bottom of this page.

## Handling headers with WebFilters

`WebFilter`s function much like their [servelt counterparts](https://www.oracle.com/technetwork/java/filters-137243.html), but using Spring and Reactor specific APIs. 

To start, we start we create a Spring `@Component` implementing the `WebFilter` interface. In this component, we register two methods, one for copying the MDCs passed as request headers to the context, a second one to copy the context to the response. Context, in this case, refers to a [well documented](https://projectreactor.io/docs/core/release/reference/#context) concept to handle orthogonal concerns with Reactor (one of the building blocks of Spring WebFulx). 

```java
@Component
public class MdcHeaderFilter implements WebFilter {
    @Override
    @NonNull
    public Mono<Void> filter(
        @NonNull ServerWebExchange ex, 
        @NonNull WebFilterChain chain) {
        ex.getResponse().beforeCommit(
            () -> addContextToHttpResponseHeaders(ex.getResponse())
        );

        return chain.filter(ex)
                .subscriberContext(
                    ctx -> addRequestHeadersToContext(ex.getRequest(), ctx)
                );
    }
}
```

Although it might not look like it, `addRequestHeaderstToContext` gets invoked first (in fact before any `@Controller`s) and `addContextToHttpResponseHeaders` is called after the request has been processed by the respective controller. There is one caveat, we should address right away to avoid unpleasant surprises in the future. The `beforeCommit` callback gets executed only if the request handlers leave no exception uncaught. As context in logs is especially important, if something goes wrong, we shall make sure, that no exception goes uncaught (I had to learn this the hard way...). There are many solutions to solve this; we'll go with a `@ControllerAdvice` capable of improvement for now:

```java
@ControllerAdvice
public class WebExceptionHandler {
    @ExceptionHandler
    @ResponseBody
    public Mono<ResponseEntity<String>> gottaCatchEmAll(
        Exception e, 
        ServerWebExchange ex) {

        return Mono.just(
            ResponseEntity
                .status(status)
                .body(e.getMessage())
        );
    }
}
```

With that out of the way, we take a look at the two callbacks from the `WebFilter`. `addRequestHeaderstToContext` inspects all headers of every request passed through it and extracts all headers starting with `X-MDC-` and populates a Map with them. Before returning, the Map is added to the context passed as a parameter to the method. A mutable map is now stored within the otherwise immutable `Context`, allowing us to quite easily add additional context information in the handlers as we shall see soon. 

```java
private static final String MDC_HEADER_PREFIX = "X-MDC-";
private static final String CONTEXT_MAP = "context-map";

private Context addRequestHeadersToContext(
        final ServerHttpRequest request,
        final Context context) {

    final Map<String, String> contextMap = request
            .getHeaders().toSingleValueMap().entrySet()
            .stream()
            .filter(x -> x.getKey().startsWith(MDC_HEADER_PREFIX))
            .collect(
                    toMap(v -> v.getKey().substring(MDC_HEADER_PREFIX.length()),
                            Map.Entry::getValue
                    )
            );

    return context.put(CONTEXT_MAP, contextMap);
}
```

The purpose of `addContextToHttpResponseHeaders` is the exact opposite. It prefixes all entries in the context map with `X-MDC-` and adds them to the response headers.

```java
private Mono<Void> addContextToHttpResponseHeaders(
        final ServerHttpResponse res) {

    return Mono.subscriberContext().doOnNext(ctx -> {
        if (!ctx.hasKey(CONTEXT_MAP)) return;

        final HttpHeaders headers = res.getHeaders();
        ctx.<Map<String, String>>get(CONTEXT_MAP).forEach(
                (key, value) -> headers.add(MDC_HEADER_PREFIX + key, value)
        );
    }).then();
}
```

> An aside: In Spring 5.0.4 this was not working as expected which motivated me to open my first [issue](https://jira.spring.io/browse/SPR-16597) with Spring. Luckily it was quickly addressed and fixed in Spring 5.0.5.

## Summary

With a simple demo controller, we shall now verify whether our filter works as expected. 

```java
@RestController
public class DemoController {
    private static final Collector<CharSequence, ?, String> COLLECTOR
            = Collectors.joining("," + System.lineSeparator(), "[", "]");

    private static Mono<String> apply(String prefix) {
        return Mono.subscriberContext()
                .map(x -> x.<Map<String, String>>get(CONTEXT_MAP))
                .map(x -> prefix + x.entrySet().stream()
                        .map(kv -> kv.getKey() + ": " + kv.getValue())
                        .collect(COLLECTOR));
    }

    @GetMapping("/demo")
    public Mono<String> demo() {
        return Mono.just("The context contains: " + System.lineSeparator())
                .flatMap(DemoController::apply);
    }
}
```

Above REST controller responds to requests to `/demo` with the content of the current context. Let's see, how it works out.

```bash
$ curl -v -H "X-MDC-FOO: BAR" localhost:8080/demo
> GET /demo HTTP/1.1
> Host: localhost:8080
> User-Agent: curl/7.58.0
> Accept: */*
> X-MDC-FOO: BAR
>
< HTTP/1.1 200 OK
< Content-Type: text/plain;charset=UTF-8
< Content-Length: 34
< X-MDC-FOO: BAR
<
The context contains:
[FOO: BAR]
```

You might have noticed, that the context is returned as response headers. Very well and just as expected. In part two, we investigate how we can add more information to the context, and leverage it in the application logs.

> The entire project (including part two) is on [github](https://github.com/tkp1n/mdc-webflux) for your reference.