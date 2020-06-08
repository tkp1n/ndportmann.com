## Prep

- Use Ubuntu 20.04 (WSL works)
- Run `sudo apt install nodejs npm`
- Run `sudo npm i -g gatsby`
- Run `sudo npm install`

## Mem hack (useful on macOS)

- `node --max_old_space_size=8000 $(which npm) run-script build`

## Develop

- Run `gatsby develop`

## Publish

- Push to `master` - GitHub Actions will publish