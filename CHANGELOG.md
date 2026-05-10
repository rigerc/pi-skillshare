# Changelog

## [0.1.6](https://github.com/rigerc/pi-skillshare/compare/pi-skillshare-v0.1.5...pi-skillshare-v0.1.6) (2026-05-10)


### Features

* add 'Check for skillshare updates on start' setting ([6783987](https://github.com/rigerc/pi-skillshare/commit/6783987f381da62f72980838437bd2aa9992ae24))
* add /skillshare-analyze command ([78a196f](https://github.com/rigerc/pi-skillshare/commit/78a196f359ebd4e732471b6ac8cf53d76450c347))
* close search panel when installation starts ([7172211](https://github.com/rigerc/pi-skillshare/commit/7172211f0e7b930820ea5ce32f0c5d69fe3be9c9))
* show focused search result description in TUI ([f2dd54b](https://github.com/rigerc/pi-skillshare/commit/f2dd54b96b7de82cd06e7bc155b50ad3239c32e8))


### Bug Fixes

* address error handling gaps found in audit ([5728ed5](https://github.com/rigerc/pi-skillshare/commit/5728ed5501b8a42d8dc116f55e4e84a2d0cfffb2))
* always open tabbed TUI for /skillshare regardless of query ([8d5692f](https://github.com/rigerc/pi-skillshare/commit/8d5692f3df4bb4f264c9e2b9873a40b8ec9b025c))
* close UI on uninstall, add spinner, fix --force flag ([10d220d](https://github.com/rigerc/pi-skillshare/commit/10d220d983195408015eff412b65f0fb3ef4ba9b))
* defer TUI open until search results are ready ([81e4d56](https://github.com/rigerc/pi-skillshare/commit/81e4d564bb6ba8fdf8fc8a19a365693b96f4a4ea))
* make scroll indicators dynamic and stable ([d97a77a](https://github.com/rigerc/pi-skillshare/commit/d97a77ae07b124aa702ce378d00d9efe77f0ee71))
* reserve fixed height for description to prevent layout jumps ([bcf1b75](https://github.com/rigerc/pi-skillshare/commit/bcf1b754c318078160cbdff624870537c6beea93))
* restore spinner during pre-TUI search ([b41ab68](https://github.com/rigerc/pi-skillshare/commit/b41ab685fd3b8357d28dd864c7e881bd7be1c6cb))
* use --json for install/uninstall, suppress raw CLI output ([82f580d](https://github.com/rigerc/pi-skillshare/commit/82f580d098b160b45da78f6c166505a67d24020b))

## [0.1.5](https://github.com/rigerc/pi-skillshare/compare/pi-skillshare-v0.1.4...pi-skillshare-v0.1.5) (2026-05-10)


### Bug Fixes

* make skill install async to prevent TUI freeze ([762a07f](https://github.com/rigerc/pi-skillshare/commit/762a07f515835570a1db8ed2ae1fff4302c034ca))

## [0.1.4](https://github.com/rigerc/pi-skillshare/compare/pi-skillshare-v0.1.3...pi-skillshare-v0.1.4) (2026-05-09)


### Features

* **search:** add star sorting to SearchPanel with relevance default ([73bf595](https://github.com/rigerc/pi-skillshare/commit/73bf595746540ea7f31970ac08f78bdc5b050b91))

## [0.1.3](https://github.com/rigerc/pi-skillshare/compare/pi-skillshare-v0.1.2...pi-skillshare-v0.1.3) (2026-05-09)


### Bug Fixes

* cleanup ([16a6857](https://github.com/rigerc/pi-skillshare/commit/16a68574bec6ca6d9ace9d2a33bec950ca9021dd))
* Correctly format settings panel options ([1a28301](https://github.com/rigerc/pi-skillshare/commit/1a28301fb6015d6787476bdc1d8497e96a793b45))
* crash ([6f73e3f](https://github.com/rigerc/pi-skillshare/commit/6f73e3fef9bce73679b4247006a3dd4893e50f90))
* migrate CLI wrappers from execSync to execFileSync to prevent shell injection ([5c288be](https://github.com/rigerc/pi-skillshare/commit/5c288bec569ab7768fc648fdbcd2b92ad2543f08))
* open brace ([650024e](https://github.com/rigerc/pi-skillshare/commit/650024ef9d912f590f20f1b631cdac918f2d9bd2))
* prevent openUI process leak with PID tracking ([c866e43](https://github.com/rigerc/pi-skillshare/commit/c866e4316eb0a7f0c31ef40916ab31d7af9d091f))

## [0.1.2](https://github.com/rigerc/pi-skillshare/compare/pi-skillshare-v0.1.1...pi-skillshare-v0.1.2) (2026-05-09)


### Bug Fixes

* 🐛 npm flow ([58d123b](https://github.com/rigerc/pi-skillshare/commit/58d123bc6736a4a283e2397dba23531b8c9201b2))

## [0.1.1](https://github.com/rigerc/pi-skillshare/compare/pi-skillshare-v0.1.0...pi-skillshare-v0.1.1) (2026-05-09)


### Features

* 💡 set up release automation with release-please ([78880c0](https://github.com/rigerc/pi-skillshare/commit/78880c0171903dc0f873af7d73db917cc2a4c712))

## Changelog

All notable changes to **pi-skillshare** are documented here.
