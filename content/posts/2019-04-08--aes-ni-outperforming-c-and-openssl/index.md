---
title: AES-NI (.NET) - Outperforming C and OpenSSL
category: "crypto"
cover: marc-olivier-jodoin-291607-unsplash.jpg
author: nicolas portmann
---

> This is the third and last post of a small series on AES-NI and .NET Core hardware intrinsics. Please also have a look at the [first post](https://ndportmann.com/improving-dotnet-crypto-code/) and the [second post](https://ndportmann.com/aes-ni-key-expansion/).

## The challenge

```
We have a message for you.
It’s 3ncryp73d and we want you to crack it.
The decrypted message will contain further instructions.

Knowns:
- The algorithm is AES (Rijndael)
- Blocksize: 128
- Keysize: 256
- You only need to find the first 6 bytes of the key, the rest are 0’s, so:
    [?,?,?,?,?,?,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
- All bytes in the key has an integer value between 0 and 16.
- The initialization vector is (base64 encoded): "DkBbcmQo1QH+ed1wTyBynA=="
- The text is just plain ASCII english

The encrypted text (base64 encoded):

yptyoDdVBdQtGhgoePppYHnWyugGmy0j81sf3zBeUXEO/LYRw+2XmVa0/v6YiSy9Kj8gMn/gNu2I7dPmfgSEHPUDJpNpiOWmmW1/jw/Pt29Are5tumWmnfkazcAb23xe7B4ruPZVxUEhfn/IrZPNZdr4cQNrHNgEv2ts8gVFuOBU+p792UPy8/mEIhW5ECppxGIb7Yrpg4w7IYNeFtX5d9W4W1t2e+6PcdcjkBK4a8y1cjEtuQ07RpPChOvLcSzlB/Bg7UKntzorRsn+y/d72qD2QxRzcXgbynCNalF7zaT6pEnwKB4i05fTQw6nB7SU1w2/EvCGlfiyR2Ia08mA0GikqegYA6xG/EAGs3ZJ0aQUGt0YZz0P7uBsQKdmCg7jzzEMHyGZDNGTj0F2dOFHLSOTT2/GGSht8eD/Ae7u/xnJj0bGgAKMtNttGFlNyvKpt2vDDT3Orfk6Jk/rD4CIz6O/Tnt0NkJLucHtIyvBYGtQR4+mhbfUELkczeDSxTXGDLaiU3de6tPaa0/vjzizoUbNFdfkIly/HWINdHoO83E=

Trustpilot Development Team

Biting the red pill
```

> Trustpilot: http://followthewhiterabbit.trustpilot.com/challenge2.html

## 73.074 s - A solid baseline

In the [first post](https://ndportmann.com/improving-dotnet-crypto-code/) of this series, we analyzed a straightforward implementation of an AES brute-force attack against a known ciphertext. The task at hand requires us to decrypt a given ciphertext with $17^6$ different keys which should yield a human-readable plaintext in roughly $17^6 \over 2$ operations. To determine whether the plaintext produced by the brute-force attack is human-readable, we search for the string "trust" which we expect to be part of the plaintext.

If all you care about is solving the challenge cited above, [this](https://github.com/ronnieholm/Playground/blob/012c19b8b6035704e522b4d9a875164ae6f54ac6/TrustpilotAesChallenge/CSharp/Program.cs) may be the source you come up with, and there is nothing wrong with that. You may, however, be slightly offended when you realize, that the execution time of the referenced C# snippet is more than an order of magnitude slower than its C counterpart. If this is you, then read on. We end up beating the C counterpart (available [here](https://github.com/ronnieholm/Playground/blob/master/TrustpilotAesChallenge/C/program.c)). By a lot!

The source code we started with, looks close to the following snippet.

```csharp
private static readonly Aes Cipher = // setup of Cipher omitted...

bool InnerLoop(byte[] cipherText, byte[] key, byte[] iv)
{
    var decryptor = Cipher.CreateDecryptor(key, iv);
    string clearText;
    using (var ms = new MemoryStream(cipherText))
    using (var cs = new CryptoStream(ms, decryptor, CryptoStreamMode.Read))
    using (var sr = new StreamReader(cs))
    {
        clearText = sr.ReadToEnd();
    }
    return clearText.Contains("trust"));
}
```

> Full source: [here](https://github.com/tkp1n/AesNi/blob/master/AesNi.BruteForce/FwBaseline.cs)

## 10.702 s - Best bang for the buck

Analyzing the initial approach to the challenge, we realized that about **85% of the time was spent handling `Streams` and converting raw bytes to `string`s**. Transforming the source code to a version which reuses the same `byte[]` as a target for all decrypt operations was relatively straightforward. Translating the string "trust" to a byte[] with its ASCII values to make use of `IndexOf()` defined on `Span<byte>` was easy enough as well. This helps to avoid the conversion of the plaintext to a `string`.

Using those two optimizations alone, we were able to reduce the runtime from 73s to 11s. The measurements of the [first post](https://ndportmann.com/improving-dotnet-crypto-code/) showed, that we now use 85% of the time to decrypt and 10% to search for the string "trust". An excellent reduction of overhead rewarded with **a 6.5x improvement** in runtime.

```csharp
private static readonly Aes Cipher = // setup of Cipher omitted...

private static ReadOnlySpan<byte> Trust =>
    new byte[] { 0x74, 0x72, 0x75, 0x73, 0x74 };

bool InnerLoop(byte[] cipherText, byte[] plaintext, byte[] key, byte[] iv)
{
    var decryptor = Aes.CreateDecryptor(key, iv);
    decryptor.TransformBlock(cipherText, 0, cipherText.Length, plaintext, 0);
    return plaintext.AsSpan().IndexOf(Trust) >= 0;
}
```

> Full source: [here](https://github.com/tkp1n/AesNi/blob/master/AesNi.BruteForce/FwTuned.cs)

## 1.884 s - Flexing the intrinics muscles

At the end of the [first post](https://ndportmann.com/improving-dotnet-crypto-code/), we realized, that roughly **60% of the total runtime of the above approach is spent creating `ICryptoTransform` instances** for the ever-changing AES keys in the brute-force code. The [second post](https://ndportmann.com/aes-ni-key-expansion/) focused purely on the AES key expansion using the hardware intrinsics for Intel's AES-NI. With the upcoming 3.0 release of .NET Core, we get direct access to all sorts of hardware intrinsics via the `System.Runtime.Intrinsics` namespace! The AES key expansion can be implemented almost entirely using the two instructions `AESKEYGENASSIST` and `AESIMC` (InverseMixColumns, to calculate the decryption round keys). Check out [Aes128Key.cs](https://github.com/tkp1n/AesNi/blob/master/AesNi/Aes128Key.cs) as an example.

Implementing the AES key expansion in plain C# leveraging the AES-NI instructions (as well as some SSE2 instructions), we were able to calculate the round keys **23x faster** than the time required to create the `ICryptoTransform` instances in above examples. In the closing words of the [second post](https://ndportmann.com/aes-ni-key-expansion/), I presented a recipe for turning C/C++ code using Intel intrinsics into C#. Using this recipe, I translated the AES (ECB, CBC, and GCM) from the two Intel white-papers found [here](https://www.intel.com/content/dam/doc/white-paper/advanced-encryption-standard-new-instructions-set-paper.pdf) and [here](https://software.intel.com/sites/default/files/managed/72/cc/clmul-wp-rev-2.02-2014-04-20.pdf) into C#. The source code, as well as a bunch of general-purpose benchmarks for it, are available in my [AesNi](https://github.com/tkp1n/AesNi) repository. 

This AES implementation lets us use the round keys calculated as described in the [second post](https://ndportmann.com/aes-ni-key-expansion/) directly, getting rid of all the framework overhead. To encrypt or decrypt, all round keys are loaded into 128-bit (XMM) registers. The plaintext blocks are also loaded sequentially into 128-bit registers, to be processed togethger with the round keys as the second operand to the  `AESENC`/`AESDEC` (and `AESENCLAST`/`AESDECLAST`) instructions. The `Encrypt` method of [Aes.128.Cbc.cs](https://github.com/tkp1n/AesNi/blob/2cfb5312d2250c386d2a5402b80b58ef660bebf9/AesNi/Aes.128.Cbc.cs#L20) serves as a nice illustration of this procedure. You may notice, that the source code looks a bit weird. This is because arrays and loops are avoided (manually unrolled) to increase the performance of the methods. Unfortunately, .NET Core JIT is (not yet) smart enough to perform those kinds of unrolling.

The results are incredible; we achieve yet **another 5.5x improvement** over the approach above. At this point, we outperform the OpenSSL based brute-force code written in C.

Luckily the task at hand focuses on AES-CBC-256 decryptions, as AES-CBC encryption is one of the few [modes of operation](https://en.wikipedia.org/wiki/Block_cipher_mode_of_operation) that cannot be pipelined (parallelized). When pipelining AES operations, we execute multiple `AESENC`/`AESDEC` instructions using multiple blocks and the same round key (as seen [here](https://github.com/tkp1n/AesNi/blob/2cfb5312d2250c386d2a5402b80b58ef660bebf9/AesNi/Aes.128.Cbc.cs#L155)). Those instructions are "data independent" and can be performed in parallel by the CPU (at least to some extent). If you are interested in the optimizations and internals of the AES implementation, give my repository a visit and make sure to read up on [Nemanja Mijailovic's excellent post](https://mijailovic.net/2018/06/18/aes-armv8/) on implementing AES for ARMv8, which served as an inspiration for my work.

> Full source: [here](https://github.com/tkp1n/AesNi/blob/master/AesNi.BruteForce/NiNormal.cs)

## 239 ms - Showing off

> What can we do when we can’t optimize the single-threaded code any further? We parallelize it!  
> \- [Adam Sitnik](https://adamsitnik.com/Sample-Perf-Investigation/#whats-next)

The brute-force task described above is easily parallelized. We could, for example, spawn 17 threads (0-16), each testing all keys with the first byte fixed to a value from 0-16. Spawning more threads than cores (or more precisely hyper-threads) available on the machine is not profitable as we are directly bound by the hardware performing the AES operations. On a 4-core machine, it would, therefore, be better to spawn 4 threads trying all keys starting with 0-3, 4-7, 8-11, 12-16 respectively with the last thread ending up with a bit more work than the others.

This is exactly what I did [here](https://github.com/tkp1n/AesNi/blob/master/AesNi.BruteForce/NiParallel.cs). I was able to break the ciphertext above in 239ms on my 16-core workstation with a [TR 1950X](https://www.amd.com/en/products/cpu/amd-ryzen-threadripper-1950x) and in 1.203s on my 2-core MacBook with an [I7-6660U](https://ark.intel.com/content/www/us/en/ark/products/91169/intel-core-i7-6660u-processor-4m-cache-up-to-3-40-ghz.html).

To parallelize the workload, we could have used `Parallel.For` or one of it's friends from the TPL, but as this series is about removing overhead - not adding it - I decided against it. 

> Full source: [here](https://github.com/tkp1n/AesNi/blob/master/AesNi.BruteForce/NiParallel.cs)

## Main Takeaways

This series of blog posts have shown, that .NET Core is an excellent platform for developer productivity. It is straightforward to get things done with relatively few lines of code. If you care about performance, little changes to the existing code are enough to improve things quite drastically. Finally, if every clock cycle matters, there are enough low-level primitives at your disposal, to create a solution capable of outperforming native code.

The essential tips to take away, are:

* Avoid the use of overhead-heavy constructs (e.g., `ICryptoTransform`, `Stream`) on the hot path.
* Avoid unnecessary conversions between data formats.
* Try to reuse buffers (byte arrays) instead of allocating in loops.
* Make use of the frameworks excellent vectorized functions over `Span<T>`.
* If you have the time, invest in utilizing hardware intrinsics for the performance critical percent of your application.

Let me close with the benchmark results of the single-shot, cold-start performance of the various methods compared throughout this post.

|        Method | Workstation |  MacBook |
|-------------- |------------:|---------:|
|    FwOriginal |    73.074 s | 129.432 s|
|   FwOptimized |    10.702 s |  14.820 s|
| AesNiOriginal |     1.884 s |   2.295 s|
| AesNiParallel |     0.239 s |   1.203 s|