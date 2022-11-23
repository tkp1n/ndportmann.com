---
title: On the Post-quantum Security of Modes of Operation
category: "pqc"
cover: "vishnu-mohanan-pfR18JNEMv8-unsplash.jpg"
author: Nicolas Portmann
permalink: "/pq-security-of-modes-of-operation/"
---

The danger of large-scale quantum computers to asymmetric cryptography is well studied and understood. Considerable research and standardization efforts are ongoing to provide the next generation of asymmetric cryptographic primitives for a post-quantum world. 
However, relatively little attention is paid to the post-quantum security of symmetric cryptography. The standard recommendation is to double the key size and to increase the state [[BC+22]](https://eprint.iacr.org/2022/1342.pdf) to counter the quadratic speedup in an exhaustive key search using Grover's [[G97]](https://link.aps.org/doi/10.1103/PhysRevLett.79.4709) algorithm. 

Recent works [[KL+16]](https://arxiv.org/pdf/1602.05973.pdf) [[SS16]](https://arxiv.org/pdf/1603.07856.pdf) have, however, shown that Simon's quantum period finding algorithm [[S94]](https://ieeexplore.ieee.org/document/365701) breaks many of the current MAC and authenticated encryption schemes. The attacks in [[SS16]](https://arxiv.org/pdf/1603.07856.pdf) are carried out with a polynomial number of quantum queries providing a speedup over attacks using Grover comparable to the speedups provided by Shor when breaking asymmetric primitives. Similarly, [[AT+16]](https://eprint.iacr.org/2016/197.pdf) proved the (in)security of various block cipher modes of operation in a quantum setting.

The following article describes different notions of security in classical and quantum settings and summarizes the security of block cipher modes of operation against said security notions. 

## Confidentiality

### IND-CPA

Indistinguishability under chosen plaintext attack (IND-CPA) is a classical security notion in which an adversary interacts with an encryption oracle in two phases: the learning and the challenge phase.

1. **Initialization:** The challenger picks a random key K and a  random bit $b$.
1. **Learning:** The adversary sends chosen plaintext messages $P$ to the oracle and receives the corresponding ciphertexts $C = \mathsf{Enc}_K(P)$ in return.
2. **Challenge:** The adversary sends two chosen plaintext messages $P_0$ and $P_1$ to the oracle but receives the corresponding cipher text of only one of the plaintext messages chosen by the oracle at random $C^* = \mathsf{Enc}_K(P_b)$. The adversary guesses the random bit $b'$ wins if $b' = b$.

A cryptographic scheme is considered IND-CPA secure if the adversary can gain only negligible insights into which plaintext message was chosen for encryption by the oracle. In other words, the adversary must not be able to guess with a certainty of >50% which plaintext message was encrypted by the oracle.

[[CE+20]](https://eprint.iacr.org/2020/596.pdf) provides additional detail on the various variants of the IND-CPA notion.

### IND-qCPA

[[BZ13]](https://eprint.iacr.org/2013/088.pdf) defines indistinguishability under a quantum chosen message attack (IND-qCPA) as the following game:

1. **Initialization:** The challenger picks a random key K and a  random bit $b$.
1. **Learning:** The adversary sends chosen plaintext messages $P$ to the oracle and receives the corresponding ciphertexts $C = \mathsf{Enc}_K(P)$ in return. The message $P$ may be a *superposition* of different messages.
2. **Challenge:** The adversary sends two chosen plaintext messages $P_0$ and $P_1$ to the oracle in a *classical* query and receives the corresponding cipher text of only one of the plaintext messages chosen by the oracle at random $C^* = \mathsf{Enc}_K(P_b)$. The adversary guesses the random bit $b'$ wins if $b' = b$.

The inconsistency between the learning with quantum queries and the challenge phase with a classical query resulted in further work [[GKS20]](https://eprint.iacr.org/2020/266.pdf) [[CEV20]](https://eprint.iacr.org/2020/237) and various definitions for qIND-qCPA [[CE+20]](https://eprint.iacr.org/2020/596.pdf) outlined in the chapter below.

### qIND-qCPA

[[CE+20]](https://eprint.iacr.org/2020/596.pdf) enumerates all possible definitions of quantum IND-CPA notions and organizes them into 14 panels (qIND-qCPA-P1 to -P14) of equivalent notions. The paper also answers how those notions relate to each other and which are the strongest.

The panels qIND-qCPA-P1 and qIND-qCPA-P2 of [[CE+20]](https://eprint.iacr.org/2020/596.pdf) imply all other panels. A scheme that is secure in the sense of the notions in panels 1 and 2 is, therefore, secure with respect to all notions.

[[BB+20]](https://eprint.iacr.org/2020/1304.pdf) shows that no online mode of encryption satisfies qIND-qCPA. [[NAD22]](https://eprint.iacr.org/2022/236.pdf) confirms in more detail which panels of qIND-qCPA are satisfied for a selection of current modes of operation.

### PRF vs. qPRF

The (q)IND-qCPA security of specific modes of operation depends on whether the mode is used in combination with a classically secure PRF (pseudo-random function) or a quantum secure qPRF. PRFs are secure under classical queries to the encryption oracle, while qPRFs are secure under queries in superposition.

It is currently reasonable to assume that AES is a qPRF [[BNS19]](https://tosc.iacr.org/index.php/ToSC/article/view/8314/7663) as no significant quantum attacks besides Grover ("quantum brute-force") have been proposed yet. Whether this is actually the case remains an open question.

### Summary of Results

| **Mode**  | **IND-CPA** |     **IND-qCPA**    || **qIND-qCPA** |
|           |             | with PRF | with qPRF |               |
|:---------:|:-----------:|:--------------------:|:-------------:|:-:|
| **ECB**   | ❌          | ❌        | ❌        | ❌            |
| **CBC**   | ✅          | ❌        | ✅        | ❌            |
| **CFB**   | ✅          | ❌        | ✅        | ❌            |
| **OFB**   | ✅          | ✅        | ✅        | ❌            |
| **CTR**   | ✅          | ✅        | ✅        | ❌            |
| **XTS**   | ❓          | ❌        | ❓        | ❌            |
| **OCB1**  | ✅          | ❌        | ❌        | ❌            |
| **OCB2**  | ⚠️✅⚠️        | ✅        | ✅        | ❌            |
| **OCB3**  | ✅          | ❌        | ❌        | ❌            |
| **CCM**   | ✅          | ✅        | ✅        | ❌            |
| **GCM**   | ✅          | ✅        | ✅        | ❌            |

> Sources: [[AT+16]](https://eprint.iacr.org/2016/197.pdf) [[W08]](https://eprint.iacr.org/2008/121.pdf) [[R11]](https://www.cs.ucdavis.edu/~rogaway/papers/modes.pdf) [[MM+22]](https://eprint.iacr.org/2022/699.pdf) [[NAD22]](https://eprint.iacr.org/2022/236.pdf)

**Notes on XTS:** The security goals for XTS are neither defined by IEEE nor by NIST. It remains an open question what security goals XTS meets. Also, note that XTS is only approved for encrypting a storage device. [[R11]](https://www.cs.ucdavis.edu/~rogaway/papers/modes.pdf)

**Notes on OCB2:** The classical security of OCB2 has been broken with regard to authenticity and confidentiality since [[II+18]](https://eprint.iacr.org/2019/311.pdf), even though OCB2 remains IND-CPA secure. OCB2 is IND-qCPA secure if and only if used as a "pure" AE mode (without associated data) [[MM+22]](https://eprint.iacr.org/2022/699.pdf).

**Notes on CCM and GCM**: The CCM mode (Counter with CBC-MAC) and GCM (Galois/Counter Mode) inherit their excellent security properties with regard to confidentiality from the counter mode (CTR) on which they are based.

### Relevance

The primary focus of post-quantum research is rightfully on asymmetric cryptographic primitives. "Harvest now, decrypt later" is already a threat to messages protected via classical hybrid cryptography (e.g., ECDH+AES). Encrypted messages collected today can be decrypted once cryptographically relevant quantum computers exist. To do so, it suffices to break the asymmetric scheme used to exchange the ephemeral key. No attacks on symmetric cryptography are required in this attack path.

IND-qCPA and qIND-qCPA become relevant once quantum cryptography modules allow operations on superpositions of messages. Such a quantum cryptography module will threaten messages exchanged today only if today's keys get transferred into such a module and if it allows queries using vulnerable modes of use. This scenario is somewhat contrived as symmetric keys used today are usually short-lived session keys. Long-term symmetric keys usually reside in current-gen cryptography modules and will never (must not) be transferred into next-gen/quantum cryptography modules.

The results shown above should therefore serve solely as a motivation for designing new modes of operation that remain secure in a post-quantum world. Knowing what we know now about the current modes of operation, it is improbable that quantum-enabled cryptography modules will operate with the modes of operation listed above.

## Unforgeability

[[KL+16]](https://arxiv.org/pdf/1602.05973.pdf) gives applications of Simon's algorithm to break the unforgeability of CBC-MAC (including XCBC, OMAC, and CMAC), GMAC (including GCM), PMAC, and OCB.

[[BB+20]](https://eprint.iacr.org/2020/1304.pdf) proposes a new mode of operation called QCB and proves its security under IND-qCPA and EUF-qCMA

### EUF-CMA

In this classical model, a MAC is said to be secure if, after making $q$ queries to the MAC, no adversary can produce $q + 1$ valid input-output pairs.

1. **Initialization:** The challenger picks a random key $K$.
2. **Learning:** The adversary performs queries with messages $M$ against the oracle and receives $T = \mathsf{Mac}_K(M)$ in return.
3. **Forgery:** The adversary produces a pair ($M$, $T$) and wins if $\mathsf{Ver}_K(M,T)=\top$.

### BZ-unforgeability

In the BZ-unforgeability experiment [[BZ13]](https://eprint.iacr.org/2013/088.pdf), the adversary is granted full quantum oracle access to the MAC. In this model, a MAC is said to be secure if, after making $q$ queries to the MAC, no adversary can produce $q + 1$ valid input-output pairs.

1. **Initialization:** The challenger picks a random key $K$.
2. **Learning:** The adversary performs queries with messages $M$ against the oracle and receives $T = \mathsf{Mac}_K(M)$ in return. The queries can be in superposition.
3. **Forgery:** The adversary produces a pair ($M$, $T$) and wins if $\mathsf{Ver}_K(M,T)=\top$.

The authors of [[AM+18]](https://eprint.iacr.org/2018/1150.pdf) proved that it is possible to construct a BZ-unforgeable MAC for which it is possible to forge a message outside of a subset of the message space after $q$ queries in superposition to this space. To close this gap, Blind-unforgeability was introduced.

### Blind-unforgeability (BU)

In the Blind-unforgeability experiment [[AM+18]](https://eprint.iacr.org/2018/1150.pdf), the adversary is granted quantum oracle access to the MAC, "blinded" at a random region $B$. $B$ is a $\varepsilon$-fraction of the message space $\mathcal{M}$. Queried with messages $M \in B$ the oracle returns $\bot$ and $\mathsf{Mac}_K(M)$ otherwise.

$$M \to \begin{cases}
    \bot               & \quad \text{if } M \in B_\varepsilon \text{,}\\
    \mathsf{Mac}_K(M)  & \quad \text{otherwise}
  \end{cases}$$

1. **Initialization:** The adversary selects a parameter $\varepsilon < 1$. The challenger picks a random key $K$, a random bit $b$, a random blinding $B_\varepsilon$, which is a $\varepsilon$-fraction of the message space $\mathcal{M}$.
2. **Learning:** the adversary queries the “blinded” MAC described above.
3. **Forgery:** The adversary produces a pair ($M$, $T$) and wins if $M \in B_\varepsilon$ and $\mathsf{Ver}_K(M,T)=\top$.

A MAC is blind-unforgeable (BU) if the probability of winning the blind forgery experiment is negligible.

Any BU-unforgeable MAC is BZ-unforgeable.

### Summary of results

| **Mode**               | **EUF-CMA** | **BU** |
|:----------------------:|:-----------:|:------:|
| **CBC-MAC**            | ✅          | ❌      |
| **GMAC**               | ✅          | ❌      |
| **PMAC**               | ✅          | ❌      |
| **OCB\***              | ✅*         | ❌      |
| **QCB**                | ✅          | ✅      |
| **Lamport signatures** | ✅          | ✅      |

> Sources: [[KL+16]](https://arxiv.org/pdf/1602.05973.pdf) [[BB+20]](https://eprint.iacr.org/2020/1304.pdf)

*) OCB2 is insecure since [[II+18]](https://eprint.iacr.org/2019/311.pdf)

### Relevance

Similar observations as made above regarding confidentiality can be made here. The MACs and tags of messages exchanged today are usually verified upon receipt of the message and lose relevance immediately after that. MACs that must hold long-term are produced with cryptographic modules incapable of serving quantum queries (with messages in superposition). Should quantum-enabled cryptographic modules exist in the future, it is recommended not to transfer current long-term keys into them to avoid exploitation via algorithms such as Simon's.