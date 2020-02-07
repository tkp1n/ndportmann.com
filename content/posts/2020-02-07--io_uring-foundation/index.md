---
title: An io_uring based Transport Layer (Part II) - Foundation
category: "iouring"
cover: "mirko-blicke-V_y81v_lI4k-unsplash.jpg"
author: nicolas portmann
---

In this series, we are going to explore what it takes to develop an `io_uring`-based Transport layer for .NET. In this episode, we introduce the `IoUring`-library - the foundation on which we shall build our Transport layer.

Make sure to check out the [previous episode](https://ndportmann.com/io_uring-rationale/) in this series, where we talked about what a .NET Transport layer is, and why we should build a new one.
If you are already familiar with the basics of Linux network programming and `IoUring`s native counterpart `liburing`, by all means, skip this episode and come back for the next one, once it's ready.

## Linux Network Programming Fundamentals

This chapter is a **very** high-level overview and over-simplification of the syscalls traditionally involved in writing TCP client/server code. I highly recommend the books by Richard Stevens (e.g., [UNIX Network Programming](https://www.amazon.com/dp/0131411551/ref=cm_sw_em_r_mt_dp_U_kNepEbW5QN4R0)), if you want to dig deeper.

It typically all starts with a call to `socket`. We specify the family, type, and protocol of the I/O we want to perform and receive a socket file descriptor in return. Remember, everything in Linux is a file.

### Server-Side

A TCP server continues by calling `bind`, to assign the socket to an address (port) on the server. Once bound to a port, the server can start to `listen` with the next syscall. When calling `listen`, the server specifies the number of pending incoming connections it wants to queue up. A call to `accept` returns an actual client connection, once a client tries to connect to the server. The file descriptor returned by `accept` is later used to exchange data with the client.

### Client-Side

On the client-side, things are uncomplicated. Once we have a socket, obtained through the equally named syscall, we can `connect` directly to a server by specifying its address.

### Exchanging Data

Syscalls like `read` (and co.) receive data, while their `write` counterparts send data across the socket. It all ends, once one party calls `close` to terminate the connection.

## Non-blocking Sockets and Polling

Without modification, the above syscalls are all blocking the calling thread. Blocking means that the invoked functions only return once the requested operation completed. For example, `accept` only returns once a client connects to the server. While these syscalls are doing their thing, the thread calling it is blocked and cannot do anything else. It turns out this is rather inefficient, as threads are still a valuable resource that we should use as efficiently as possible.

Non-blocking options were added to the syscalls mentioned above to mitigate this inefficiency. With those options enabled, the syscalls return immediately. Even if the requested operation is still in progress, we can, therefore, start multiple socket operations using the same thread and use a polling and waiting mechanism to check and wait for the requested operations to complete. The best way to perform this polling and waiting *was* the `epoll` interface. *Was* because, with `io_uring`, we now have an even better option at hand.

Describing the `epoll` interface in detail is too much for the scope of this episode. Since we aren't using it in our endeavor, this shouldn't matter too much.

## Reducing the Number of Syscalls

In [the last episode](https://ndportmann.com/io_uring-rationale/), we established some levers we can pull to optimize the performance of networking code. One of those is the reduction of syscalls. The rationale behind this is the cost associated with invoking syscalls. Again, check out the [previous episode](https://ndportmann.com/io_uring-rationale/) for more details on this.

The community introduced `libaio` (AIO) to tackle this problem. The new syscalls behind AIO can be used to submit multiple socket operations at once (`io_submit`) and to get the results for completed operations with another syscall `io_getevents`. Unfortunately, AIO didn't solve all our problems. `io_submit` can (sometimes) block, and performance overall isn't great. See this [presentation from Jens Axboe](https://www.youtube.com/watch?v=-5T4Cjw46ys) for more hints in this direction.

## Enter `io_uring`

> DISCLAIMER: This post covers parts of the `io_uring` API surface that shipped with kernel version 5.4. It grew a lot since then, but by the time of writing, 5.4 is LTS.

Jens Axboe introduced `io_uring` to solve a multitude of issues around non-blocking, fast, and parallel I/O with few syscalls. "One API to rule them all" so to say. `io_uring` consists of two ring buffers (hence the name): a submission queue and a completion queue. The application writes I/O operations to the submission queue, which the kernel consumes and executes. The kernel, on the other hand, writes the results of the completed I/O operations to the completion queue, which the application consumes and inspects. There is no "syscall-tax" per submission or completion because the memory behind the two queues is shared between the kernel and the application. Setting up an `io_uring`-instance is, therefore, relatively involved.

### Setup

The syscall `io_uring_setup` allows us to specify the desired size of the submission queue. The kernel adjusts this number to the next power of two, given it isn't already chosen as such. The kernel, in turn, defines the size of the completion queue to be twice as large as the submission queue by default, although the user can overwrite this.

#### Completion Queue Size and Overflows

The completion queue should be larger than the submission queue to ensure there is enough space for queued up operations to complete "at the same time". Newer kernel versions (> 5.5.) have an internal buffer to avoid completion queue overflows. On platforms where this feature is lacking, the application has to take care that no more I/O operations are in flight than fit the completion queue.

#### I/O Polling

I/O in the Linux kernel usually is interrupt-driven. In interrupt mode, the I/O device notifies the kernel via a so-called interrupt about the completion of I/O operations. With `io_uring`, we have the option to enable I/O polling (a privileged operation). Interrupt driven I/O is more efficient for most workloads, as it prevents the kernel from wasting CPU cycles by polling for I/O operations that are still pending.

#### Submission Queue Polling

Typically, the user application must notify the kernel about I/O operations added to the submission queue. `io_uring` offers the privileged option to enable submission queue polling. In this mode, the kernel polls the submission Queue until a configurable time-out. Should the time-out occur, the kernel falls back to the normal mode where the application must notify the kernel about submissions.

#### The C# API - Constructor

Behind the scenes, the setup of an `io_uring` instance is relatively complicated. It includes not only the call to `io_uring_setup` but also multiple `mmap`s to get access to the shared memory behind the two ring buffers. All of this complexity is handled for you by the constructor of the `Ring` class introduced in [`IoUring`](https://github.com/tkp1n/IoUring). Given the explanation of the various options above, the following two samples are hopefully fairly self-explanatory.

```csharp
var ioUringDefault = new Ring(4096);
var ioUringCrazy = new Ring(4096, new RingOptions
{
    CompletionQueueSize = 4096 * 4,
    EnablePolledIo = true,
    EnableSubmissionPolling = true,
    PollingThreadIdleAfter = TimeSpan.FromSeconds(10),
    SubmissionQueuePollingCpuAffinity = 1
});
```

All settings can be queried as public properties on the `Ring` instance. The most interesting one is the size of the completion queue, as it is set by the kernel.

#### A Word of Warning: ENOMEM

On most Linux distributions, the limit on the locked bytes of memory is set relatively low. This leads to errors (`ENOMEM`), even when creating small rings. To adjust this limit, increase the configuration of the value `RLIMIT_MEMLOCK`. How this is done exactly depends on your distribution. Please refer to the [README](https://github.com/tkp1n/IoUring#setting-proper-resource-limits-rlimit_memlock) of `IoUring` for a starting point on how this is achieved.

### Prepare I/O Operations

Before I/O operations can be submitted to the kernel for execution, they need to be prepared. Preparing an I/O operation is relatively cheap and done by copying some pointers and flags. It neither includes a syscall, nor a memory-barrier. The number of I/O operations that can be prepared without submitting them is limited by the size of the ring (or, more specifically, the submission queue size) set during its construction.

It is generally desirable to prepare as many I/O operations as possible before submitting them. Submitting the prepared operations includes at least a memory-barrier when in polling mode and additionally a syscall in "normal mode".

To get an overview over the I/O operations supported by `io_uring`, please refer to the LWN article ["The rapid growth of io_uring"](https://lwn.net/Articles/810414/). I couldn't do much more than copying Jonathan's statements there.

#### User data

Each I/O operation carries 64-bits of user data. This user data is read by the kernel and routed through to the completion queue entry. This allows the application to establish a context between a submission and a completion.

#### Submit Options

Various options can be set with each I/O operation to control how it is executed:

* `IOSQE_IO_DRAIN` - execute this operation once all other pending operations are completed.
* `IOSQE_IO_LINK` - execute this and all following operations with this flag set in the order they were submitted.
* ... additional options were introduced after kernel version 5.4 - not discussed here.

#### The C# API - PrepareXXX

Let's have a look at how some of the supported I/O operations can be prepared using the C# API:

```csharp
var r = new Ring(4096);

// Prepare a no-op with the drain option set
r.PrepareNop(userData: 42UL, options: SubmissionOption.Drain);

// Prepare a 'readv' on the file descriptor fd using nrOfIovecs iovecs
r.PrepareReadV(fileDescriptor, iovecs, nrOfIovecs, userData: 43UL);

// Add a one-shot poll for POLLIN on the given socket file descriptor
r.PreparePollAdd(socket, (ushort) POLLIN, userData: 44UL);
```

### Submit and Reap Completions

We learned how to create a `Ring` and prepare I/O operations. All we need now is a way to make the kernel aware of the prepared submissions and to check for, or wait for completions.

#### The C# API - Submit & Flush

```csharp

// Submit all prepared operations
var nofSubmittedOps = r.Submit();

// Flush all submitted operations and block until 1 completed
var nofFlushedOps = r.Flush(nofSubmittedOps, minComplete: 1);
```

That's it.

The `Submit` helper method introduces a memory-barrier so that the kernel has a chance to see what we've prepared for it. If the kernel is in polling mode, a call to submit is enough, given the polling time-out hasn't triggered yet. `Flush` is an intelligent wrapper around the syscall `io_uring_enter` that is responsible for both making the kernel aware of the submitted items but also to reap the completions that happened since the last call. It is intelligent, because if the kernel is in the polling mode, the syscall is only made if the kernel currently isn't "sleeping" after a time-out. If polling is not enabled, `Flush` always calls `io_uring_enter`. The second, optional parameter is the number of completions to await. If this parameter is set to `0`, the call does not block.

Note that even with `minComplete` set to `0` `Flush` could take a while, as most submitted operations are started during the invocation and, if possible without blocking, completed synchronously.

This is the most exciting feature of `io_uring`. One syscall to:

* Submit multiple I/O operations
* Complete all operations that can be completed synchronously without blocking
* Get the result of all operations that completed since the last call

### Inspect Completions

Completions are straightforward. A struct, two members. The user data provided when preparing the operation that completed and its result. If the result is negative, it is the "negative errno" that lead to the error. Non-negative results can be considered a successful completion of the I/O operation.

#### The C# API - Completions

```csharp
Completion c = default;
while (r.TryRead(ref c))
{
    if (c.result < 0) throw new ErrnoException(-c.result);
    Console.Write($"I/O operation {c.userData} completed");
    Console.WriteLine($"successfully with result: {c.result}");
}
```

## Summary

The Linux network and I/O APIs have evolved drastically over the years. What started with some simple syscalls quickly became a hard to navigate landscape of async options and functions. `io_uring` promises to simplify things again for network developers. Just a couple of syscalls, easily wrapped and hidden behind a library like `liburing` or `IoUring` enable us to quickly write high-performance networking code.

Stay tuned for more episodes on this topic and check out the [`IoUring`](https://github.com/tkp1n/IoUring) repository, where we build next network Transport layer for .NET. If you want to get involved, there are a couple of open issues waiting for eager contributors 😉.
