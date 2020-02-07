---
title: An io_uring based Transport Layer (Part I) - Rationale
category: "iouring"
cover: ethan-robertson-FmMzl1RA7FY-unsplash.jpg
author: nicolas portmann
---

In this series, we are going to explore what it takes to develop an `io_uring`-based Transport layer for .NET. But before we are getting down to the nitty-gritty, we should think about whether this endeavor is a good idea to begin with.

If you are writing network code for a living or are otherwise familiar with the topic, by all means, skip this episode and check out [the next one](https://ndportmann.com/io_uring-foundation/).

## What is a Transport Layer?

Let's start by answering the question of what a Transport layer is. David Fowler and friends (both inside and outside of Microsoft) developed the ASP.NET Connections Abstractions as part of a project codenamed "Bedrock". If we talk about the Bedrock abstractions here, we talk about the classes and interfaces available as [Microsoft.AspNetCore.Connections.Abstractions](https://github.com/dotnet/aspnetcore/tree/master/src/Servers/Connections.Abstractions/src).

There are three core concepts to the architecture of Bedrock ([source](https://speakerdeck.com/davidfowl/project-bedrock)) upon which most networked .NET applications are built:

* Transports
* Middleware
* Protocols

**Transports** are concerned with how we obtain connections and how bytes are transferred from/to those connections. **Middleware** handles cross-cutting concerns (e.g., sessions, authentication), a concept familiar to ASP.NET developers. **Protocols** handle the details of specific protocols to give the bytes received from a connection a meaning.

There are already a couple of Transport implementations (also called layers) out there. Most prominently, the [Sockets Transport](https://github.com/dotnet/aspnetcore/tree/master/src/Servers/Kestrel/Transport.Sockets) used in Kestrel by default. The Sockets Transport is based on the `Socket` type from the base class library (BCL). It is cleverly written and well optimized.

The community contributed another, Linux-specific Transport layer.  [redhat-developer/kestrel-linux-transport](https://github.com/redhat-developer/kestrel-linux-transport/) is tailored to the best in class Linux APIs for networking (`epoll`, `AIO`, and co.). See Tom Deseyns [blog post introducing the project](https://developers.redhat.com/blog/2018/07/24/improv-net-core-kestrel-performance-linux/) for details.

## Why yet another Transport Layer?

So why do we need yet another Transport layer? Well, there is a new kid on the block called `io_uring`. It promises to improve the I/O story for Linux and generally bring better performance to I/O heavy applications. Details on how this is achieved can be found in [this slideshow](https://www.slideshare.net/ennael/kernel-recipes-2019-faster-io-through-iouring).

With a smart design and some fancy kernel-tricks, `io_uring` offers an API for writing high-performance network code without relying on "dirty tricks". Userspace network drivers (e.g., DPDK) use stunts such as *kernel bypass* to achieve high performance at the cost of losing everything the kernel has to offer.

The current Transport layers were built in a time before the adoption of `io_uring` in an LTS kernel version. `io_uring` is still being developed with new features added in every recent kernel version. What better time than now to investigate the use of `io_uring` in .NET, when we can still contribute to its development via feedback to the kernel devs.

Writing a new Transport layer doesn't only benefit ASP.NET Core. Other frameworks and libraries, such as Orleans, are also jumping onto the Bedrock abstractions. A faster Transport, therefore, means improvements across many applications. And in times where you pay your cloud provider by the CPU cycle, performance matters not only for your users 🚀 but also for your wallet 💸.

This series is, therefore, a documentation of the journey towards building yet another Transport layer for .NET networking applications based on the new io_uring API: To outperform the previously mentioned Sockets and Linux Transports on Linux kernels that support it.

## Why is `io_uring` significant?

### The Cost of syscalls

Ren et al. discovered in their 2019 paper *[An Analysis of Performance Evolution of Linux’s Core Operations](https://dl.acm.org/doi/pdf/10.1145/3341301.3359640?download=true)* that the cost of syscalls such as `mmap`, `read`, `write` have gone up significantly in recent times. The 11 root causes responsible for the slowdown fall in one of three categories:

* **Security Enhancements** that likely cause permanent slowdowns due to software mitigation for hardware (CPU) issues.
* **New Features** that add overhead or just haven't been properly optimized yet.
* **Configuration Changes**, which were discovered and - for the most part - fixed in recent kernel versions

Surprisingly, the security enhancements are the least impactful of the above.

Writing a high-performance network or I/O stack offers many opportunities for optimizations. This is likely the reason why there are so many different network stacks. The go-to site to compare network stacks is [TechEmpower](https://www.techempower.com/benchmarks), where well over 300 frameworks, runtimes, and configurations compete against each other.

The underlying optimization techniques are, however, the same for most I/O stacks and include but aren't limited to the following guidelines:

* Avoid syscalls
* Never block (`O_NONBLOCK`)
* Never copy (`SO_ZEROCOPY`)
* Avoid interrupts (polled I/O)
* Optimize thread affinity

### Enter `io_uring`

`io_uring` - the brainchild of [Jens Axboe](https://twitter.com/axboe) -  is the latest addition to the I/O interfaces of the Linux kernel. It improves the status quo regarding most of the above levers for performance. In theory and extreme cases, it even enables  I/O-operations without any syscalls at all. In more reasonable settings, it allows for a drastically reduced number of syscalls for a given application and to minimize the cost of I/O-operations using neat tricks such as [using pre-mapped I/O buffers](https://patchwork.kernel.org/patch/10792947/).

If you are used to the BCL, Linux I/O APIs are rarely easy to consume. This is especially true for more sophisticated interfaces such as `epoll`. The same holds for `io_uring`, which is probably why Jens Axboe started writing the [`liburing`](https://github.com/axboe/liburing) library to make it somewhat easier to profit from `io_uring`.

`liburing` offers convenience methods for each operation supported by `io_uring`. While being convenient, this would mean a lot of P/Invoked methods in the Transport layer should we decide to leverage `liburing`. With the license of `liburing` [changed to MIT](https://github.com/axboe/liburing/commit/b9f507d50c71b27f5c0239a28fa29db5ce2bf533), it was relatively easy to reverse engineer it and to write a similar but managed library: [IoUring](https://github.com/tkp1n/IoUring/#iouring).

IoUring builds the foundation upon which the IoUring.Transport is built - a foundation which we explore in detail, in [the next episode](https://ndportmann.com/io_uring-foundation/) of this series.

## Summary

A new set of I/O interfaces were added to the most recent LTS version of the Linux kernel. There is currently no way to profit from the new APIs from a .NET application. At the same time, the introduction of the Bedrock abstractions made it easier than ever to add a new Transport layer to networked .NET applications. The best time to experiment with an `io_uring` based Transport is now. [tkp1n/IoUring](https://github.com/tkp1n/IoUring) is open for contributions!