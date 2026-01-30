# Contributing to Vidulum App

Thank you for your interest in contributing to Vidulum App! This project is built by the people, for the people, and we welcome contributions from developers of all skill levels.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Code Style](#code-style)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)
- [Adding New Networks](#adding-new-networks)
- [Documentation](#documentation)
- [Security](#security)
- [License](#license)

## Code of Conduct

We are committed to providing a welcoming and inclusive environment for all contributors. Please be respectful and professional in all interactions.

### Our Standards

- Be respectful and considerate
- Accept constructive criticism gracefully
- Focus on what is best for the community and the project
- Show empathy towards other contributors

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm (comes with Node.js)
- Git
- A Chromium-based browser (Chrome, Edge, Brave, etc.) for testing

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/vidulum-app.git
   cd vidulum-app
   ```

3. Add the upstream repository:
   ```bash
   git remote add upstream https://github.com/Corey-Code/vidulum-app.git
   ```

### Install Dependencies

```bash
npm install
```

### Build the Extension

```bash
# Development build with watch mode
npm run dev

# Production build
npm run build
```

### Load in Browser

1. Navigate to `chrome://extensions` (or equivalent in your browser)
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist` folder from the project

## Development Workflow

### Branch Strategy

1. Keep your fork up to date:
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

2. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. Make your changes and commit them:
   ```bash
   git add .
   git commit -m "Add validation for EVM chain configuration"
   # Or: git commit -m "Fix balance calculation for Cosmos staking rewards"
   ```

4. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

### Development Commands

```bash
# Start development server with hot reload
npm run dev

# Build all components
npm run build

# Run tests
npm test

# Lint code
npm run lint

# Sync Cosmos chain registry
npm run sync:chains

# Sync EVM chain registry
npm run sync:evm
```

## Testing

We use Jest for testing. Please ensure all tests pass before submitting a pull request.

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch
```

### Writing Tests

- Write tests for new features and bug fixes
- Follow existing test patterns in the `tests/` directory
- Aim for good test coverage, especially for critical functionality like cryptographic operations

## Code Style

This project uses ESLint and Prettier to maintain consistent code style.

### Automatic Formatting

- Code is automatically formatted using Prettier
- ESLint checks are enforced in the CI pipeline

### Guidelines

- Use TypeScript for all new code
- Follow existing patterns and conventions (see `src/` for examples)
  - Component structure: see `src/popup/components/`
  - Network configurations: see `src/lib/networks/`
  - Crypto operations: see `src/lib/crypto/`
- Write clear, self-documenting code
- Add comments for complex logic
- Use meaningful variable and function names

### Running Linters

```bash
# Check for linting errors
npm run lint
```

## Pull Request Process

1. **Ensure your code builds and tests pass**:
   ```bash
   npm run build
   npm test
   npm run lint
   ```

2. **Update documentation** if you're adding or changing functionality

3. **Create a Pull Request** with:
   - Clear title describing the change
   - Description of what was changed and why
   - Reference to any related issues (e.g., "Fixes #123")
   - Screenshots if UI changes are involved

4. **Wait for review**:
   - A maintainer will review your PR
   - Address any feedback or requested changes
   - Once approved, a maintainer will merge your PR

### PR Guidelines

- Keep PRs focused on a single change or feature
- Break large changes into smaller, reviewable PRs
- Ensure commit messages are clear and descriptive
- Keep commits atomic and logical

## Issue Reporting

### Bug Reports

When reporting bugs, please include:

- Browser version and operating system
- Steps to reproduce the issue
- Expected behavior
- Actual behavior
- Screenshots or error messages if applicable
- Network affected (if applicable)

### Feature Requests

When requesting features, please include:

- Clear description of the feature
- Use case and why it would be beneficial
- Any relevant examples or mockups

### Security Issues

**Do not report security vulnerabilities through public GitHub issues.** See the [Security](#security) section below.

## Adding New Networks

We welcome contributions to add support for new blockchain networks!

### Documentation

Detailed guides are available for adding different types of networks:

- [Adding a Cosmos Chain](docs/ADDING_COSMOS_CHAIN.md) - For Cosmos SDK-based networks
- [Adding a UTXO Chain](docs/ADDING_UTXO_CHAIN.md) - For Bitcoin-like networks
- [Adding an EVM Chain](docs/ADDING_EVM_CHAIN.md) - For Ethereum-compatible networks

### General Process

1. Read the appropriate documentation above
2. Add network configuration to the relevant file in `src/lib/networks/`
3. Test thoroughly with testnet first
4. Update README.md with the new network
5. Submit a pull request with detailed testing information

## Documentation

Good documentation is crucial for an open-source project.

### Updating Documentation

- Update README.md if you add features or change setup instructions
- Update relevant docs in `docs/` folder for technical changes
- Use clear, concise language
- Include code examples where appropriate

### Documentation Standards

- Use Markdown format
- Follow existing documentation structure
- Keep it up to date with code changes

## Security

### Reporting Security Vulnerabilities

If you discover a security vulnerability, please **DO NOT** open a public issue.

Instead, please report it responsibly by:

1. Opening a private security advisory on GitHub:
   - Go to the repository's Security tab
   - Click "Report a vulnerability"
   - Provide detailed information about the vulnerability
2. Or create a draft security advisory if you have discovered a CVE
3. Allow time for the issue to be addressed before public disclosure

Alternatively, you can reach out to the maintainers through GitHub by opening a private discussion or checking the repository for contact information.

### Security Considerations

This is a cryptocurrency wallet dealing with private keys and user funds. When contributing:

- Never commit secrets, private keys, or mnemonics
- Be extra careful with cryptographic operations
- Follow secure coding practices
- Test security-critical changes thoroughly
- Review the [Data Storage](docs/DATA_STORAGE.md) documentation

## License

By contributing to Vidulum App, you agree that your contributions will be licensed under the MIT License.

This means your code will be:
- Free to use, modify, and distribute
- Open source and publicly available
- Part of a community-driven project

## Questions?

If you have questions or need help:

- Open a GitHub issue for bugs or feature requests
- Check existing issues and documentation first
- Be patient - maintainers are volunteers

## Thank You!

Your contributions help make Vidulum App better for everyone. Whether you're fixing bugs, adding features, improving documentation, or helping other users, your efforts are appreciated!

Remember: This wallet is built by the people, for the people. Together, we're building a trustworthy, transparent tool for managing cryptocurrency assets.
