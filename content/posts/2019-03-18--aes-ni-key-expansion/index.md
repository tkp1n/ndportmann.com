---
title: AES-NI (.NET) - Key Expansion
category: "crypto"
cover: sebastian-davenport-handley-746868-unsplash.jpg
author: nicolas portmann
---

> This is the second post of a small series on AES-NI and .NET Core hardware intrinsics. Please also have a look at the [first post](https://ndportmann.com/improving-dotnet-crypto-code/) and be patient for the next one, to which I'll add the link once it is are ready.

We concluded the last post in this series with the realization, that the .NET frameworks AES implementation isn't optimized for encrypting small payloads with quickly changing keys. Creating the `ICryptoTransform` for the ever-changing AES keys in the brute-force code we analyzed in the last post was responsible for about 60% of the total runtime of the "attack".

This post will, therefore, focus on how we can reduce this overhead by implementing only the absolute minimum required to work with a new AES key; the key expansion. The AES key expansion is required to expand the 128-, 192- or 256-bits of keying material to a key schedule of 10, 12 or 14 round keys (128-bits each). The exact nature of this process is described in detail in [NIST FIPS 197](https://nvlpubs.nist.gov/nistpubs/fips/nist.fips.197.pdf) which standardized Rijndael as AES in 2001. As this series is about .NET hardware intrinsics, we also refer to the [Intel white-paper](https://www.intel.com/content/dam/doc/white-paper/advanced-encryption-standard-new-instructions-set-paper.pdf) which introduced the use of Intel's AES new instructions in 2008.

## History lesson (skip if you are not interested)

In 2008, most AES implementations were written entirely in software. There were some [FPGAs](https://iacr.org/archive/ches2005/031.pdf) and even [ASICs](https://www.heliontech.com/aes.htm) for AES but not in consumer hardware. The software implementations were highly optimized but still relatively slow compared to applications based on current CPUs supporting AES-NI. The most common optimization trick was using lookup tables to avoid expensive calculations during encryption/decryption. This optimization technique, however, opened the door for an entire set of attacks against those AES implementations. As the lookup tables are typically big enough that they don't fit into a single cache line, cache/timing side-channel attacks became possible. Other possible weaknesses of the software implementations included, of course, human error (speak: security bugs) which may have led to data-dependent timing or completely different attack vectors.

Introducing AES-NI: It is very uncommon, that a piece of software/hardware increases both security and performance. AES-NI is one of those precious pieces of tech. With the tricky bits of AES implemented in hardware (the CPU) and exposed to application and library developers as hardware intrinsics, highly performant and secure AES implementations became a reality. Until recently, those intrinsics were mainly available to C/C++ developers, but with the introduction of hardware intrinsics in .NET Core 3.0 that all changed. The remainder of this blog series will focus on the journey of implementing AES in managed C# code using the AES-NI intrinsics provided in the current .NET Core preview.

## AES key expansion

Back to the topic at hand. As indicated above, each AES key will be expanded to a 10, 12 or 14 round key schedule for encryption, and another equally sized key schedule for decryption (as AES-NI is based on the Equivalent Inverse Cipher approach described in [NIST FIPS 197](https://nvlpubs.nist.gov/nistpubs/fips/nist.fips.197.pdf)). This key schedule is typically calculated once and ahead of time. This ensures that the cost of the key expansion is amortized over its usage period. Implementations doing the key expansion on the fly are also possible but not profitable unless a minimal amount of blocks are encrypted with each key. To accommodate the key schedule we introduce a class per AES key size containing an array of 4 `int`s per round key required plus another 4 `int`s for the original key. The size of this array could be calculated as $2 * 4 * (N_R + 1)$ (with $N_R$ as the number of rounds). We can, however, save a few bytes by acknowledging, that the actual key (stored as `key[0]` in the schedule) is used by both the encryption and decryption algorithm. Furthermore, the last round key for the encryption is reused as the first round key while decrypting.

This leaves us with the following formula to calculate the space required (in `int`s) for the key schedule: $2 * 4 * N_R$.

## `class` vs. `readonly ref struct`

One design decision was whether a `class` or a `readonly ref struct` would be the better home for the key schedule. The advantage of a `readonly ref struct` is the ability to wrap a `Span<T>` which would allow keeping the key schedule entirely on the stack (using `stackalloc`) and avoid heap allocations. There are however many downsides to `ref structs`:

* An instance of a key schedule represented as a class can be referred to by many threads.
* It is exponentially more convenient for consumers if they can keep a reference to the key (schedule) on the heap if it is used over a prolonged period of time.
* Inheritance and [type patterns](https://docs.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/switch#type-pattern) ([as used here](https://github.com/tkp1n/AesNi/blob/ee982b8fd3a5a9cbfb40af7c30259e286f12e8bb/AesNi/Aes.cs#L67)) are the idiomatic way to handle "same but different"-problems in C#. In fact, it even allows keeping the APIs clear of the actual types of keys and to transparently apply the correct AES variant (AES-128, AES-192 or AES-256) to a given problem based on the type of the provided key.

With so many arguments in favor of classes, the decision is clear. We must, however, find a way to accommodate for the "brute-force attack" use case from the first post. The current design decision would require us to allocate a new instance of the AES-256 class (including a $2 * 4 * 14$ `int` array) for every key we would like to try out. Unacceptable. As a work-around to my own design decision, I introduced the instance method `ReKey` which performs the key expansion for a new input key and stores it in the internal array of the key instance. A dirty trick (breaking the thread safety of the key instances) to improve the performance of the brute-force attack, which I will most likely reconsider in the future.

## Implementation

The actual implementation of the key expansion revolves around the instruction `AESKEYGENASSIST` and is provided by [Intels white-paper](https://www.intel.com/content/dam/doc/white-paper/advanced-encryption-standard-new-instructions-set-paper.pdf) in figures 24, 25 and 26. It is important to note, that referenced figures of the white-paper only illustrate the key expansion for the encryption half of the key schedule. The decryption key schedule is calculated by applying the instruction `AESIMC` (IMC = InverseMixColumns) to the round keys $1..N_R-1$ of the encryption key schedule.

Porting the C code provided by Intel to C# is relatively straight forward, but still rather cumbersome. It could be described as the following "algorithm":

* Treat all `__m128i` variables as `Vector128<?>` (use common sense to determine `?` in a way that minimizes the need for step 3 below)
* For each intrinsic in the C code do:
  * Copy the name of the intrinsic and search for it in the [CoreCLR](https://github.com/dotnet/coreclr) repository
  * Find the equivalent name of the C# intrinsic and use it in your C# code
  * If required, use the `AsXYZ()` extension methods on the `Vector128<?>` class to make the type system happy

Egor Bogatov is currently busy automating this exact process https://twitter.com/EgorBo/status/1106006223390953473

## Usage

The entire source is available on my GitHub under the name [AesNi](https://github.com/tkp1n/AesNi). The following snippet showcases the usage of the key expansion as well as the reusability of the `key` instance using the `ReKey` method.

```csharp
var keyBytes = new byte[32]; // fill with actual key
var key = AesKey.Create(keyBytes); // creates reusable instance of Aes256Key

// use initial key schedule
Aes.Decrypt(input, output, iv, key, CipherMode.CBC, PaddingMode.None);

keyBytes = // generate some other key
key.ReKey(keyBytes); // performs inplace key expansion

// use new key schedule
Aes.Decrypt(input, output, iv, key, CipherMode.CBC, PaddingMode.None);
```

## Performance results

Creating $17^6$ `ICryptoTransform` instances takes 16'318ms (as shown in the last post). The managed AES-NI based implementation introduced in this post requires only 684ms to perform $17^6$ key expansions. A ~23x improvement!

The next post will introduce the actual encryption and decryption operations using AES-NI in C# and showcase the final performance result of the complete implementation of the brute-force attack using .NET hardware intrinsics.