## Prep

- Use Ubuntu (WSL works)
- Install node [from here](https://github.com/nodesource/distributions/blob/master/README.md#deb)
- Run `sudo apt-get install libjpeg-dev libpng-dev libtiff-dev libgif-dev libglu1 libxi6 libgconf-2-4`
- Run `sudo npm i -g gatsby`

## Mem hack (useful on macOS)

- `node --max_old_space_size=8000 $(which npm) run-script build`

## Develop

- Run `gatsby develop`

## Publish

- Push to `master` - GitHub Actions will publish