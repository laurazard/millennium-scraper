# millennium-scraper

![Node.js CI](https://github.com/laurabrehm/millennium-scraper/workflows/Node.js%20CI/badge.svg)


Do you use [YNAB](https://www.youneedabudget.com)? Is your bank [Millennium](http://millenniumbcp.pt)? Are you tired of manually noting down your transactions because YNAB/third party sync apps don't offer integrations for your bank?

Well so was I! Which is why I wrote this small project that uses [Puppeteer](https://github.com/puppeteer/puppeteer) to log into Millennium's web banking platform, fetch my latest transactions, and import them into YNAB. That's it. 

I'd develop this further into something other people can use since YNAB supports OAUTH applications but since there's no easy lawful way for me to get permission to integrate with Millennium, you'd have to give the application your personal banking ID and secret number and that's no bueno. However, feel free to clone/fork this for personal use!
