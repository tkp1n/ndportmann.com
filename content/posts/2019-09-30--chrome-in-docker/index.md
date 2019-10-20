---
title: Running Chrome in Docker for CI/CD
category: "webdev"
cover: chuttersnap-9cCeS9Sg6nU-unsplash.jpg
author: nicolas portmann
---

Running Chrome headless in Docker turns out to be surprisingly hard. Many resources on the internet suggest to disable the sandbox, and everything works fine. **Please don't trust random people on the internet, telling you to disable security features**.

Ask yourself the following: Do you really trust all the, let's say **18847 packages** that are included with a barebones `ng new` Angular application to run outside a sandbox? I sure don't.

**`Tl;dr`** Checkout the [README](https://github.com/tkp1n/chromium-ci/blob/master/README.md) of `tkp1n/chromium` to get started.

As you've decided to skip the short version, let's start with why you want to run Chrome in Docker in the first place.

## Rationale

Testing web applications is typically done within a browser. I use Chrome to test the Angular app I'm working on at the moment. Naturally, I want to execute those tests as part of the CI/CD pipeline of the project as well. That's is where things get tricky. The easiest would be to install Chrome on the build server. That is what you get if you make use of [GitHub Actions](https://github.com/features/actions) or any other decent public CI/CD service.

Unfortunately, not everything is developed in the open and convincing corporate IT to install Chrome on all their build servers may not be manageable. One could even argue that it isn't desirable in the first place. Consider this: I might want to test my project using a different version of Chrome than some other team. Docker makes a compelling argument both to avoid lengthy discussions with corporate IT and to get reproducible builds using the exact versions of the tools I prefer.

Two years ago, I would have likely used [PhantomJS](https://phantomjs.org/) to run automated front-end tests on a server. However, as the project is discontinued, we have to look at alternatives. The more or less drop-in replacement would be [Puppeteer](https://github.com/GoogleChrome/puppeteer) by Google. Unfortunately, Puppeteer isn't exactly plug-and-play as several dependencies to run Chrome may be missing on the target system and they do not get installed with Puppeteer. As it turns out, Puppeteer isn't even needed to test an Angular app on a build server. All you need is a working installation of Chromium and some command-line options.  

## The Docker image

I assembled a [Dockerfile](https://github.com/tkp1n/chromium-ci/blob/master/Dockerfile) on the foundation of [Alpine Linux](https://www.alpinelinux.org/), one of the smallest base images available. It uses the edge channel, as Chromium > 76 is required for things to run smoothly and it isn't yet in one of the stable versions. Luckily it is a matter of time until we can use the standard Alpine base image. The only things installed are Chromium (as well as it's recommended dependencies), Node.js and npm (to execute the tests) as well as dumb-init (explained later). A user `chromium` is created and switched to, ensuring we don't execute Chrome as a privileged user. `CHROME_BIN` is set to avoid the need for additional configuration in the applications under test (e.g., karma.conf.js), and dumb-init is bootstrapped to avoid zombie processes of Chrome sticking around as proposed by this [troubleshooting section of Puppeteer](https://github.com/GoogleChrome/puppeteer/blob/master/docs/troubleshooting.md#tips).

You may think this sounds way too straight-forward to justify a blog post and you'd be right. Sadly, things aren't as easy as they seem. Starting Chrome in the Docker image built by above Dockerfile fails spectacularly with an error similar to this:

```bash
Cannot start ChromeHeadless
Failed to move to new namespace: PID namespaces supported, Network namespace supported, but failed: errno = Operation not permitted
[0929/190238.494297:FATAL:zygote_host_impl_linux.cc(187)] Check failed: ReceiveFixedMessage(fds[0], kZygoteBootMessage, sizeof(kZygoteBootMessage), &boot_pid).
Received signal 6
  r8: 00007ffebb72b300  r9: 00007f93224c114c r10: 0000000000000008 r11: 0000000000000246
 r12: 00007ffebb72b690 r13: 0000000000000000 r14: 00007ffebb72b440 r15: 00000000000000a0
  di: 0000000000000002  si: 00007ffebb72adc0  bp: 00007ffebb72adc0  bx: 0000000000000006
  dx: 0000000000000000  ax: 0000000000000000  cx: 00007f9322474225  sp: 00007ffebb72ada8
  ip: 00007f9322474225 efl: 0000000000000246 cgf: 002b000000000033 erf: 0000000000000000
 trp: 0000000000000000 msk: 0000000000000000 cr2: 0000000000000000
[end of stack trace]
Calling _exit(1). Core file will not be generated.
```

Why is that? Because Chrome uses certain syscalls that usually aren't allowed from within a Docker container: `arch_prctl` `chroot` `clone` `fanotify_init` `name_to_handle_at` `open_by_handle_at` `setdomainname` `sethostname` `syslog` `unshare` `vhangup` `setns` [(source)](https://github.com/docker/for-linux/issues/496#issuecomment-441149510).

## Convincing Chrome to actually start

We have 4 different options to get things working again:

1. **We disable the sandbox.** This method defeats the entire purpose of this exercise. *Don't do that.*
2. **We start the Docker container with** `--privileged`**.** This way, our tests are sandboxed, but the security policies enforced by Docker are entirely disabled. *Don't do that either.*
3. **We start the Docker container with** `--cap-add=SYS_ADMIN`**.** This approach is better than the above but still not perfect. It enables CAP_SYS_ADMIN capabilities, which usually are not granted. See [capabilities(7)](http://man7.org/linux/man-pages/man7/capabilities.7.html) for more detail. The [Puppeteer troubleshooting guide](https://github.com/GoogleChrome/puppeteer/blob/master/docs/troubleshooting.md) suggests this option as well. *Do this only, if below option does not work for you.*
4. **We provide a custom seccomp**. Starting the container with `--security-opt seccomp=chrome.json` allows us to provide a JSON file with an exact whitelist of syscalls required by Chrome. We can run the browser sandbox and still prevent anything inside the container to go rouge - *My personal favorite.*

The `chrome.json` I am referring to in option 4 can be found [here](https://github.com/tkp1n/chromium-ci/blob/master/seccomp/chromium.json). It is based on the [default seccomp profile from the moby repository](https://raw.githubusercontent.com/moby/moby/master/profiles/seccomp/default.json) and the whitelist contained in the profile is extended with the syscalls mentioned above.

The Docker documentation gives a good starting point for additional information on the [seccomp security profiles](https://docs.docker.com/engine/security/seccomp/). There is even a 20-minute [lab](https://github.com/docker/labs/tree/master/security/seccomp) in which you can learn how to figure out what syscalls are missing from the default seccomp profile.

## What we've achieved

With the Docker image `tkp1n/chromium` and some tweaking - preferably by setting the extended seccomp profile as shown in the sample below - we can test an angular app on any CI/CD server that runs Docker. Without installing anything or setting Chrome into a dangerous mode.

```bash
docker run
    --security-opt seccomp=seccomp/chromium.json
    -v `pwd`/node-ci-demo:/app
    tkp1n/chromium
    npm run test -- --no-watch --browsers=ChromeHeadless
```

Also make sure to checkout the [README](https://github.com/tkp1n/chromium-ci/blob/master/README.md) of `tkp1n/chromium` to get started.
