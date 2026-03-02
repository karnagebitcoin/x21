<div align="center">
  <picture>
    <img src="./resources/logo-light.svg" alt="x21 Logo" width="400" />
  </picture>
  <p>logo designed by <a href="http://wolfertdan.com/">Daniel David</a></p>
</div>

# x21

A user-friendly Nostr client for exploring relay feeds

Experience x21 at [https://x21.social](https://x21.social)

## Run Locally

### Option 1: With URL Preview Cards (Recommended)

```bash
# Clone this repository
git clone https://github.com/CodyTseng/x21.git

# Go into the repository
cd x21

# Run with Docker (includes proxy server for URL previews)
docker compose up -d

# Access at http://localhost:8089
```

### Option 2: Without Docker (No URL previews)

```bash
# Clone this repository
git clone https://github.com/CodyTseng/x21.git

# Go into the repository
cd x21

# Install dependencies
npm install

# Run the app
npm run dev

# Note: URL preview cards won't work without the proxy server
```

## Run Docker

```bash
# Clone this repository
git clone https://github.com/CodyTseng/x21.git

# Go into the repository
cd x21

# Run the docker compose
docker compose up --build -d
```

After finishing, access: http://localhost:8089

## Sponsors

<a target="_blank" href="https://opensats.org/">
  <img alt="open-sats-logo" src="./resources/open-sats-logo.svg" height="44">
</a>

## Donate

If you like this project, you can buy me a coffee :)

- **Lightning:** ⚡️ codytseng@getalby.com ⚡️
- **Bitcoin:** bc1qwp2uqjd2dy32qfe39kehnlgx3hyey0h502fvht
- **Geyser:** https://geyser.fund/project/x21

## License

MIT
