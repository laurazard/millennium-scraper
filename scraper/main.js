const puppeteer = require("puppeteer");
const ynab = require("ynab");
const { Client } = require("pg");
const dbClient = new Client();

const userIdentifier = process.env.USER_IDENTIFIER;
const secretNumbers = process.env.SECRET_NUMBER.split("");
const ynabToken = process.env.YNAB_TOKEN;
const ynabAccountId = process.env.YNAB_ACCOUNT_ID;
const ynabAPI = new ynab.API(ynabToken);

const doImport = process.env.IMPORT;


async function fetchRecentTransactions () {
	const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
	const page = await browser.newPage();
	await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:79.0) Gecko/20100101 Firefox/79.0");
	await page.setViewport({ width: 1200, height: 800 });

	await page.goto("https://ind.millenniumbcp.pt/pt/Particulares/Pages/Welcome.aspx");

	const cookieButton = await page.$x("//*[contains(text(), 'Aceitar')]");
	await cookieButton[0].click();

	await page.waitFor("input[value=\"Código de Utilizador\"]");
	const loginUserInput = await page.$("input[value=\"Código de Utilizador\"]");
	await loginUserInput.focus();
	await page.keyboard.type(userIdentifier, { delay: 100 });

	const loginButton = await page.$x("//*[contains(text(), 'Login')]");
	await loginButton[0].click();

	const positionArray = [];

	await page.waitForXPath("//*[@id=\"btnValidate\"]");
	for (let i = 1; i < 4; i++) {
		const selector = `//*[@id='lblPosition_${i}']`;
		const element = await page.$x(selector);
		const text = await (await element[0].getProperty("textContent")).jsonValue();
		positionArray.push(text.substring(0, 1));
	}

	for (let i = 1; i < 4; i += 1) {
		const selector = `//*[@id='txtPosition_${i}']`;
		const element = await page.$x(selector);
		await element[0].focus();
		await page.keyboard.type(`${secretNumbers[positionArray[i - 1] - 1]}`);
	}

	const continueButton = await page.$x("//*[contains(text(), 'Continuar')]");
	await continueButton[0].click();

	await page.waitForXPath("//*[contains(text(), \"Mais movimentos\")]");
	const moreTransationsLink = await page.$x("//*[contains(text(), 'Mais movimentos')]");
	await moreTransationsLink[0].click();

	await page.waitFor("#ctl00_ctl00_PlaceHolderMainBase_PlaceHolderMain__bcpTransactionContainer_ctl01_divOperationInfo_gridMovements");

	const result = await page.$$eval("#ctl00_ctl00_PlaceHolderMainBase_PlaceHolderMain__bcpTransactionContainer_ctl01_divOperationInfo_gridMovements > tbody > tr", (rows) => Array.from(rows, (row) => {
		const columns = row.querySelectorAll("td");
		return Array.from(columns, (column) => column.innerText);
	}));

	await browser.close();
	return result.filter(el => {
		return el.length !== 0;
	});
}

async function importFromYNAB() {
	const allTransactionsResponse = await ynabAPI.transactions.getTransactions("last-used");
	allTransactionsResponse.data.transactions.forEach(async (el) => {
		try {
			const text = `INSERT INTO transactions(ynab_id, clear_date, amount, description, account_id) VALUES('${el.id}', '${el.date}', ${el.amount}, '${el.payee_name}', '${el.account_id}')`;
			console.log(text);
			await dbClient.query(text);
		} catch(err) {
			console.log(err);
		}
	});
}

async function getAllStoredTransactions() {
	return (await dbClient.query("SELECT * FROM transactions WHERE ynab_id <> ''")).rows;
}

async function getNewTransactionsAndPushToYNAB() {

	const storedTransactions = await getAllStoredTransactions();
	const recentTransactions = await fetchRecentTransactions();
	const newTransactions = [];

	recentTransactions.filter(el => {
		return storedTransactions.filter(element => {
			
			const dateArray = el[0].split("-");
			const date = new Date(dateArray[2] + "-" + dateArray[1] + "-" + dateArray[0]);
			if(
				element["ynab_id"] !== "" &&
				new Date(element["clear_date"]) !== date) {
				return false;
			}

			return element["amount"] !== Number(el[3].replace(",", "").replace(".", "")) * 10;
		}).length == 0;
	}).forEach(async el => {
		const dateArray = el[0].split("-");
		const date = new Date(dateArray[2] + "-" + dateArray[1] + "-" + dateArray[0]);
		const transaction = {
			account_id: ynabAccountId,
			date: date.toISOString(),
			amount: Number(el[3].replace(",", "").replace(".", "")) * 10,
			payee_name: el[2],
		};
		newTransactions.push(transaction);
	});

	try {
		await ynabAPI.transactions.createTransactions("last-used", {
			transactions: newTransactions
		});
	} catch(err) {
		console.log(err);
	}
}

(async () => {

	await dbClient.connect();

	if(doImport) {
		await importFromYNAB();
	} else {
		await getNewTransactionsAndPushToYNAB();
	}
})();
