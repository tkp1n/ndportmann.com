---
title: Logging with Context in Spring WebFlux (Part II)
category: "Java"
cover: markus-spiske-445253-unsplash.jpg
author: nicolas portmann
---

In the first part, we investigated how context information such as MDCs can be passed from and to a Spring WebFlux application. We shall now investigate how we can enrich said context and include it in our log messages.

## Adding to the Context

To add context information to the `Context`, we use the method `subscriberContext` present on all `Mono` and `Flux` instances. It accepts a `Function<Context, Context>` which transforms the exisiting immutable `Context` into a new `Context`. In this case with an additional information.

```java
public Mono<String> processRequestForClient(String clientId) {
    return Mono.from(clientId)
            .map(id -> processRequest(id))
            .subscriberContext(put("CLIENT-ID", clientId));
}
```

The helper function `put` below provides the required `Function<Context, Context>` that adds the given key and value to the context or creates a new context if none exists.

```java
private static final String CONTEXT_MAP = "context-map";

public static Function<Context, Context> put(String key, String value) {
    return ctx -> {
        Optional<Map<String, String>> maybeContextMap =
                ctx.getOrEmpty(CONTEXT_MAP);

        if (maybeContextMap.isPresent()) {
            maybeContextMap.get().put(key, value);
            return ctx;
        } else {
            Map<String, String> ctxMap = new HashMap<>();
            ctxMap.put(key, value);

            return ctx.put(CONTEXT_MAP, ctxMap);
        }
    };
}
```

Above usage of `subscriberContext` seems odd, as the addition to the context appears to be the last operation in the chain of calls. The [Reactor documentation](https://projectreactor.io/docs/core/release/reference/#_simple_examples) sheds some light on this oddity:
> Even though subscriberContext is the last piece of the chain, it is the one that gets executed first (due to its subscription time nature, and the fact that the subscription signal flows from bottom to top).

## Logging with context

Time for the final piece of the puzzle; writing logs with set context applied. Just as with the [approach suggested by Simon Basle](https://simonbasle.github.io/2018/02/contextual-logging-with-reactor-context-and-mdc/) (mentioned in the previous post), we utilize `doOnEach` with two helper methods to log with context. The helper methods, in this case, are `logOnNext` and `logOnError`. Both invoke a lambda that accepts the current result or the exception respectively. We could therefore add the following two log statemets to the `processRequestForClient` method from above.

```java
@Service
public class FooService {
    private static final Logger logger 
        = LoggerFactory.getLogger(FooService.class);

    public Mono<String> processRequestForClient(String clientId) {
        return Mono.just(clientId)
                .flatMap(id -> processRequest(id))
                .doOnEach(logOnNext(
                        res -> logger.info("Result: {}", res))
                ).doOnEach(logOnError(
                        e -> logger.warn("An error occurred...", e))
                ).subscriberContext(put("CLIENT-ID", clientId));
    }
}
```

The helper methods `logOnNext` and `logOnError` are best placed in a helper class. Both extract the context information from the `doOnEach` `Signal` and put set it as the MDC before calling the provided lambda.

```java
public final class LogHelper {
    public static <T> Consumer<Signal<T>> logOnNext(
            Consumer<T> log) {
        return signal -> {
            if (signal.getType() != SignalType.ON_NEXT) return;

            Optional<Map<String, String>> maybeContextMap
                    = signal.getContext().getOrEmpty(CONTEXT_MAP);

            if (maybeContextMap.isEmpty()) {
                log.accept(signal.get());
            } else {
                MDC.setContextMap(maybeContextMap.get());
                try {
                    log.accept(signal.get());
                } finally {
                    MDC.clear();
                }
            }
        };
    }

    public static <T> Consumer<Signal<T>> logOnError(
            Consumer<Throwable> log) {
        return signal -> {
            if (!signal.isOnError()) return;

            Optional<Map<String, String>> maybeContextMap
                    = signal.getContext().getOrEmpty(CONTEXT_MAP);

            if (maybeContextMap.isEmpty()) {
                log.accept(signal.getThrowable());
            } else {
                MDC.setContextMap(maybeContextMap.get());
                try {
                    log.accept(signal.getThrowable());
                } finally {
                    MDC.clear();
                }
            }
        };
    }
}
```

## Summary

If we extend our `DemoController` from part one with a call to above `FooService`, we are now able to perform the following request:

```java
@PostMapping("/demo/{clientId}")
public Mono<String> clientDemo(@PathVariable String clientId) {
    return fooService.processRequestForClient(clientId);
}
```

```bash
$ curl -v -X POST -H "X-MDC-FOO: BAR" localhost:8080/demo/123
> POST /demo/123 HTTP/1.1
> Host: localhost:8080
> User-Agent: curl/7.58.0
> Accept: */*
> X-MDC-FOO: BAR
>
< HTTP/1.1 200 OK
< Content-Type: text/plain;charset=UTF-8
< Content-Length: 2
< X-MDC-CLIENT-ID: 123
< X-MDC-FOO: BAR
<
42
```

The log record for the request reads as follows:  
`2019-01-04 ... FooService: Result: 42 CLIENT-ID=123, FOO=BAR`

We have therefore successfully added information to the context, which ended up both in the response headers and in the log message, together with the context from the callee.

> The entire project is on [github](https://github.com/tkp1n/mdc-webflux) for your reference.