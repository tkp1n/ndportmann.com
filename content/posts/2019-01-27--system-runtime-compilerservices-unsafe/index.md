---
title: Unsafe array access and pointer arithmetics in C#
category: "dotnet"
cover: joey-banks-380271-unsplash.jpg
author: nicolas portmann
---

Before the introduction of [ref returns and ref locals in C# 7.0](https://docs.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-7#ref-locals-and-returns) and following improvements such as [conditional ref expressions in C# 7.2](https://docs.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-7-2#conditional-ref-expressions) and [ref reassignments in C# 7.3](https://docs.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-7-3#ref-local-variables-may-be-reassigned) there was no way to perform pointer arithmetics in C# without going [unsafe](https://docs.microsoft.com/en-us/dotnet/csharp/programming-guide/unsafe-code-pointers/index). This post explores `System.Runtime.CompilerServices.Unsafe` a class capable of replacing both the `unsafe` and the `fixed` keywords from your codebase. Be aware, that doing so does not increase the readability of your codebase if anything the opposite is the case. However, it could very well make it faster.

The `fixed` keyword in C# pins an object in memory and allows you to obtain an unmanaged pointer to it. Pinning prohibits the GC from moving the object to another memory location (e.g., during compaction), while you operate on the pointer. This, in turn, implies additional bookkeeping for the GC, which should generally be avoided if possible (see "Rule 22: Avoid pinning" in the excellent [Pro .NET Memory Management by Konrad Kokosa](https://prodotnetmemory.com/)). Using the `fixed` keyword may also prevent inlining of the method using it (see [this tweet by Victor Baybekov](https://twitter.com/buybackoff/status/882256068855910400) including the PRs in the comments).

`System.Runtime.CompilerServices.Unsafe` is part of the .NET Platform Extensions which are documented [here](https://docs.microsoft.com/en-us/dotnet/api/system.runtime.compilerservices.unsafe?view=dotnet-plat-ext-2.2) and can be obtained via [NuGet](https://www.nuget.org/packages/System.Runtime.CompilerServices.Unsafe/). This post does not cover the entire API surface of `Unsafe` but focuses on accessing arrays (preferably without bounds checks) and doing pointer arithmetics.

## Why going unsafe in the first place?

C# and .NET is an excellent platform for getting work done. It focuses on developer productivity, safety and ease of use.  To make sure code written in C# / .NET does look not only pretty but also performs good, framework and library authors must focus on performance. And you should probably too, but make sure to concentrate your efforts on the 1-3% of your code base, that are actually worth optimizing (*resisting the urge to quote Knuth here*). `unsafe` code allows you to go beyond what is possible in "normal" C# (Trivia: S.R.CS.Unsafe is written in IL as the concepts introduced by it cannot be expressed in any .NET language.). Things you can only do in `unsafe` code or using the `Unsafe` class include but are not limited to:

- Random access to arrays without bounds checks
- Read from / write to "random" memory locations
- Compare references (instead of the values they refer to)
- Reinterpret (cast) a reference as a reference to a different type
- Cast without dynamic type checks.

This post will focus on the first three topics of the above list.

## Obtaining a reference

Before we can perform any `Unsafe`-magic we need to obtain a reference to an object (an array in this case). There are multiple ways to do so.

The simplest way this is achieved is with the language features provided by C# 7.0 and above. Below sample is 100% safe and will throw if the array is `null` or the specified element does not exist. This safety comes at a cost of course (see `cmp` and `jbe` in below JIT dump).

```csharp
byte[] array = new byte[8];
ref byte ptr = ref array[0];
```

```nasm
; ref byte ArrayAccess(byte[] array) 
;     => ref array[0];
L0000: cmp dword [edx+0x4], 0x0
L0004: jbe L000a
L0006: lea eax, [edx+0x8]
L0009: ret
L000a: call 0x74033430
L000f: int3
```

This method could also be used to obtain a reference to an element in the array at a given offset simply by replacing the `0` in above snippet with the desired element index. 

There is a riskier but faster way to get a reference to the 0th element of a given `Span<T>` however. Make sure you only use this, if you are certain the span is non-null and not empty. The `Span<T>` variant is branch-free.

```csharp
Span<byte> span = stackalloc byte[8];
ref byte ptr = ref MemoryMarshal.GetReference(span);
```

```nasm
; ref byte SpanAccess(Span<byte> span) 
;     => ref MemoryMarshal.GetReference(span);
L0000: lea eax, [esp+0x4]
L0004: push dword [eax+0x8]
L0007: push dword [eax+0x4]
L000a: push dword [eax]
L000c: call dword [0x52652d8c]
L0012: ret 0xc
```

Below a collection of snippets try to translate `unsafe` code to code using `Unsafe`.
To make searching easier:
- all references/pointers are named `ptr`,
- when comparing multiple references/pointers, they are named `ptr1` and `ptr2`,
- the referenced type is assumed to be `int` (unless specified otherwise)
- all values written are 0x42,
- all offsets are 12.

This should enable you to quickly find the appropriate `Unsafe` pattern for your existing `unsafe` code. Each snippet of `unsafe` code is immediately followed by the equivalent code pattern using the `Unsafe` class.

## Accessing arrays without bounds checks

Given a reference to an element in an array, other elements in the same array can easily be accessed using the `Unsafe.Add` and `Unsafe.Subtract` methods to calculate offsets relative to the existing reference. Both methods calculate the number of bytes the reference has to be moved based on the type of the reference passed as the first parameter. Internally the implementation of `Unsafe.Add` could look something like this:

```csharp
// https://github.com/dotnet/coreclr/blob/d1c1cc91a85c510c7b10461acb35b8c545fe2b07/src/System.Private.CoreLib/shared/Internal/Runtime/CompilerServices/Unsafe.cs#L108
return ref AddByteOffset(ref source, (IntPtr)(elementOffset * (nint)SizeOf<T>()));
```

As the in memory position of the `int` at array position 12 is `ptr + sizof(int) * 12` the reference is increased by `48` to point to the correct element. Meaning that there is a simpler way of accessing byte arrays; you could use `Unsafe.AddByteOffset` or `Unsafe.SubtractByteOffset` directly.

### Adding offsets to references

```c
ptr[12] = 0x42;
int* x = ptr + 12;
int y = *(ptr + 12);
```

```csharp
Unsafe.Add(ref ptr, 12) = 0x42;
ref int x = ref Unsafe.Add(ref ptr, 12);
int y = Unsafe.Add(ref ptr, 12);
```

### Subtracting offsets from references

```c
ptr[-12] = 0x42;
int* x = ptr - 12;
int y = *(ptr - 12);
```

```csharp
Unsafe.Subtract(ref ptr, 12) = 0x42;
ref int x = ref Unsafe.Subtract(ref ptr, 12);
int y = Unsafe.Subtract(ref ptr, 12);
```

### Adding offsets in iterations

```c
*ptr++ = 0x42;
*(++ptr) = 0x42;
```

```csharp
ptr = 0x42; ptr = ref Unsafe.Add(ref ptr , 1);
(ptr = ref Unsafe.Add(ref ptr, 1)) = 0x42;
```

### Subtracting offsets in iterations

```c
*ptr-- = 0x42;
*(--ptr) = 0x42;
```

```csharp
ptr = 0x42; ptr = ref Unsafe.Subtract(ref ptr , 1);
(ptr = ref Unsafe.Subtract(ref ptr, 1)) = 0x42;
```

## Comparing references

Certain use cases may require you to compare two references. Not the value they refer to, but the actual address. To make this clear, the references `ptr1` and `ptr2` refer to a different element in the array `arr`, yet C# only allows to compare the values they refer to, which are equal.

```csharp
int[] arr = new int[]{ 1, 2, 1 };
ref int ptr1 = ref arr[0];
ref int ptr2 = ref arr[2];
Debug.Assert(ptr1 == ptr2); // -> 1 == 1 -> true
```

This is where `Unsafe.AreSame` comes into play. It allows you to compare the address of two pointers and would, of course, return `false` in the above situation. Along the same lines `Unsafe.IsAddressLessThan` and `Unsafe.IsAddressGreaterThan` allow you to compare the relative position of two pointers.

### Address equality

```csharp
Debug.Assert(ptr1 == ptr2);
```

```csharp
Debug.Assert(Unsafe.AreSame(ref ptr1, ref ptr2));
```

### Address greater than / less than

```csharp
Debug.Assert(ptr1 < ptr2);
Debug.Assert(ptr1 > ptr2);
```

```csharp
Debug.Assert(Unsafe.IsAddressLessThan(ref ptr1, ref ptr2));
Debug.Assert(Unsafe.IsAddressGreaterThan(ref ptr1, ref ptr2));
```

### Calculate address differences

Be aware of two things here:

- `unsafe` pointers are always scaled to the size of the type they refer to. `Unsafe.ByteOffset` returns the unscaled difference between two pointers. Thus explaining the division by the size in below sample. Scaling is not required if the type the pointers refer to are bytes.
- Calculating the difference of two pointers requires you to pass them to `Unsafe.ByteOffset` in the opposite order as you would for the subtraction.

```c
int diff = ptr2 - ptr1;
```

```csharp
int diff = (int)Unsafe.ByteOffset(ref ptr1, ref ptr2) / Unsafe.SizeOf<int>();
```

## Copy data from one reference to another

The `Unsafe.CopyBlockUnaligned` method can be used to copy data from one location to another. Be aware, however, that this method only operates on byte references. You may have to

- reinterpret your `int` reference as a `byte` reference using `Unsafe.As<int, byte>(ref ptr)` and
- scale the number of items you want to copy to bytes using `i * Unsafe.SizeOf<int>()`.

Both points can be ignored if you are already working with `byte` references.

If you are certain that both references are aligned (point to an address that is a multiple of the platform-specific alignment), you can use the faster `Unsafe.CopyBlock`. This is always the case if both references point to the start of an array. Otherwise, it depends on the position and the platform the code is running on: The alignment of the different platforms small and large object heaps are given as follows (referring again to [Pro .NET Memory Management by Konrad Kokosa](https://prodotnetmemory.com/)):

Platform    | SOH    | LOH    |
------------|--------|--------|
**32-bit**  | 4 byte | 8 byte |
**64-bit**  | 8 byte | 8 byte |

Now without further ado, the samples:

```c
while (i-- > 0) {
    *ptr1++ = *ptr2++;
}
```

```csharp
Unsafe.CopyBlockUnaligned(
    ref Unsafe.As<int, byte>(ref ptr1), 
    ref  Unsafe.As<int, byte>(ref ptr2), 
    (uint) (i * Unsafe.SizeOf<int>()));
```

## Initializing a block of data

Just as above "`memcpy` equivalent" we also get a "`memset` equivalent" with `Unsafe`. The methods in question are named `Unsafe.InitBlock` and `Unsafe.InitBlockUnaligned`. The principles introduced in the last chapter regarding pointer scaling and alignment are true for this set of methods as well.

```c
while (i-- > 0) {
    *ptr1++ = 0x42;
}
```

```csharp
Unsafe.InitBlockUnaligned(
    ref Unsafe.As<int, byte>(ref ptr1), 
    0x42, 
    (uint) (i * Unsafe.SizeOf<int>()));
```

## Safety considerations

Make absolutely sure you never keep a reference to memory location, that does not correspond to an obejct tracked by the GC. As an example; if you keep a reference to the element right after (out of bounds) an array, the GC can and will move that array without updating your reference!

> Feel free to leave feedback, comments and questions on [reddit](https://www.reddit.com/r/dotnet/comments/akc1vv/unsafe_array_access_and_pointer_arithmetics_in_c/)