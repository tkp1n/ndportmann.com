---
title: Randomized Round Robin (Load Balancing) as Fast as Possible
category: "dotnet"
cover: taylor-vick-M5tzZtFCOfs-unsplash.jpg
author: nicolas portmann
---

Another episode on gaining performance improvements by doing the as little as possible on the hot-path.

**`Tl;dr`** Do all heavy-lifting upfront or in the background.

Load balancing is the act of distributing a given load across a set of resources. In this case, we are looking at ways to distribute requests over a set of connections to nodes performing the actual work.

The design constraints are as follows:

* Requests may arrive concurrently. The load balancer must, therefore, be thread-safe.
* Requests may come in repeating patterns that should be broken up by the load balancer (e.g., by introducing randomness).

## Synchronized Random

The most obvious way to approach this kind of problem is to use `Random` to generate an index into the given array of available connections. As `Random` isn't thread-safe, we use a `lock` to protect it. Even without contention on the `lock`, this is the slowest possible method clocking in at **26 ns** per load balancing decision.

```csharp
private static readonly Random Random = new Random();

public static Connection Select(Connection[] connections)
{
    int index;
    lock (Random)
    {
        index = Random.Next(0, connections.Length);
    }

    return connections[index];
}
```

## ThreadStatic Random

If the application re-uses the threads (thread-pooling) making the load balancing decisions, we can give each thread it’s own `ThreadStatic` `Random` instance. This way, we don't have to synchronize access to it. Doing so yields *consistently* better results at **23 ns** per load balancing decision. Consistently, because this performs independently of possible contention.

```csharp
[ThreadStatic] private static Random Random;

public static Connection Select(Connection[] connections)
{
    var r = Random;
    if (r == null)
    {
        r = new Random();
        Random = r;
    }

    var index = r.Next(0, connections.Length);
    return connections[index];
}
```

## Pre-Shuffling arrays

The next two methods are a bit more niche as they involve pre-randomizing the connection array to avoid the calls to `Random` on the hot path. If only shuffling once isn’t enough, a separate thread could periodically scramble the array in the background. To rearrange the array in-place in linear time, I suggest the use of the so-called ["Fisher-Yates shuffle"](https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle):

```csharp
public static void Shuffle<T>(T[] arr)
{
    var r = new Random();
    for (var i = arr.Length - 1; i > 0; i--)
    {
        var j = r.Next(0, i + 1);

        var temp = arr[i];
        arr[i] = arr[j];
        arr[j] = temp;
    }
}
```

## Increment and Modulo

We now assume, we have a pre-shuffled list of connections (`_connections`) and an `_index` on the load balancer class. This way, we can implement the actual load balancing decision with a simple `Interlocked.Increment` to add 1 to the `_index` in a thread-safe fashion and a modulo operation to ensure the index lies within the bounds of the `_connections` array. This approach is significantly faster than the previous two, clocking in at **13 ns**.

```csharp
public Connection Select()
{
    var index = Interlocked.Increment(ref _index);
    var connections = _connections;
    return connections[index % connections.Length];
}
```

*Note:* As a simple yet effective optimization, we copy the `_connections` reference to a local variable `connections` which produces slightly better (-1 ns) code.

## CAS Linked List

The runtime cost of the previous approach is mainly due to three things:

1. The `Interlocked` operation ensuring thread-safety
2. The `idiv` emitted by the module operation ensuring we always read within the bounds of the array
3. The bounds-check the runtime does when accessing the array (although the modulo provides safe reads)

We cannot just drop thread-safety as a design constraint, so we will most likely always use a `lock ` or at least an `Interlocked` method. But we may be able to remove the `idiv`. And indeed, we are by using a linked list of all things.

#### Aside

Linked lists are generally known for their sub-par performance as a standard list implementation. They fell into discredit because data locality is suboptimal (elements in the list are not necessarily close to each other in memory), and random-access has $O(n)$ cost. In this specific case, however, we can write better-performing code by using a linked list. **Your mileage may vary**: the larger the list, the bigger the chances that you will see performance loss due to bad data locality. To counter that, you can try to allocate the `Connection` objects and the linked list `Node`s in a tight loop. This way, the runtime will likely place them close to each other in memory. But there is no guarantee.

On to the implementation: We use a hand-written linked list in which each node comprises a reference to a `Connection` object and a reference to the next item in the list (known as "singly linked list"). Our load balancer class then holds a reference to the current "head" (a `Node`) of the list, which was created from a pre-shuffled array, as shown above. The actual load balancing method is then made up of a single CAS-loop (compare-and-swap), which will store the current node, move the "head" to the next item in the list using `Interlocked.CompareExchange` and return the `Connection` of the previously stored `Node`. If it detects that another thread messed with the list in the meantime, it tries again and again. Another reason why **you may observe different results**: if contention is so high, that a majority of the threads lose the CAS-race, performance will suffer, performance will suffer. In my case, however, the load balancing decision is only a small part of a much larger program with relatively little contention on the LB. When measured with no contention at all, this approach yields a load balancing decision roughly every **10 ns**.

```csharp
public Connection Select()
{
    Node selected;
    do
    {
        selected = _node;
    } while (
        Interlocked.CompareExchange(
            ref _node, selected.Next, selected
        ) != selected
    );

    return selected.Current;
}
```

> The full source is on GitHub at [tkp1n/lb](https://github.com/tkp1n/lb)

## The numbers

|             Method |     Mean |     Error |    StdDev | Ratio |
|------------------- |---------:|----------:|----------:|------:|
|         SyncRandom | 26.52 ns | 0.1895 ns | 0.1773 ns |  1.00 |
| ThreadStaticRandom | 22.61 ns | 0.2784 ns | 0.2605 ns |  0.85 |
|             Modulo | 13.13 ns | 0.0464 ns | 0.0388 ns |  0.50 |
|         LinkedList | 10.08 ns | 0.0109 ns | 0.0091 ns |  0.38 |