const fs = require('fs');
const path = require('path');
const Diff = require('text-diff');
const puppeteer = require('puppeteer');
const nodeNotifier = require('node-notifier');
const { notify } = require('node-notifier');
const htmlAwareDiff = require('./htmlparser');
nodeNotifier.notify('begin observer');


if (!fs.existsSync('tmp'))
{
    fs.mkdirSync('tmp');
}

let scheduler = (function ()
{
    let filename = path.resolve('tmp', 'schedule.json');
    let firstFailed = null;
    let lastFailed = null;
    let failCooldown = 2;

    function getLastRun()
    {
        try
        {
            // check if it exsits
            if (!fs.existsSync(filename))
                return null;

            let sched = fs.readFileSync(filename, 'utf-8');
            let schedJson = JSON.parse(sched);
            return {
                h: schedJson.h,
                m: schedJson.m
            }
        }
        catch (ex)
        {

        }

        return null
    }

    function getNow()
    {
        let now = new Date();

        return {
            h: now.getHours(),
            m: now.getMinutes()
        }
    }

    function hasRan()
    {
        firstFailed = null;
        lastFailed = null;
        failCooldown = 2;
        let obj = getNow();
        fs.writeFileSync(filename, JSON.stringify(obj));
    }

    function shouldRun()
    {
        let nowRun = getNow();

        if (lastFailed !== null)
        {
            let nowMin = nowRun.h * 60 + nowRun.m;
            if (nowMin < lastFailed)
                nowMin += 24 * 60;

            if (nowMin - lastFailed < failCooldown)
                return false;
        }

        let lastRun = getLastRun();
        if (lastRun === null)
        {
            return true;
        }
        if (lastRun.m >= 30)
        {
            lastRun.h += 0.5
            lastRun.m -= 30;
        }
        if (nowRun.m >= 30)
        {
            nowRun.h += 0.5;
            nowRun.m -= 30;
        }

        if (nowRun.h !== lastRun.h && nowRun.m >= 5)
        {
            return true;
        }
        return false;
    }

    function sleep(n)
    {
        return new Promise((resolve, reject) =>
        {
            setTimeout(() =>
            {
                resolve();
            }, n);
        });
    }

    function hasNotRun()
    {
        let now = getNow();
        let nowMin = now.h * 60 + now.m;

        if (firstFailed !== null)
        {
            failCooldown *= 2;
            if (failCooldown > 60) failCooldown = 60;

            if (nowMin < firstFailed) nowMin += 24 * 60;
            let diffMin = nowMin - firstFailed;

            if (diffMin > failCooldown)
                nodeNotifier.notify('observer process failed');
        }
        else
        {
            firstFailed = nowMin;
        }
        lastFailed = nowMin;
    }

    return { getLastRun, getNow, hasRan, shouldRun, sleep, hasNotRun }
})();

let observer = (function ()
{
    function notice(newTxt, id)
    {
        let oldFileName = path.resolve('tmp', id, 'old.html');
        if (fs.existsSync(oldFileName))
        {
            let oldTxt = fs.readFileSync(oldFileName, 'utf-8');
            if (oldTxt !== newTxt)
            {
                var diff = new Diff();
                var textDiff = diff.main(oldTxt, newTxt);
                let htmlDiff = diff.prettyHtml(textDiff);
                let expDiff = htmlAwareDiff.default(textDiff);

                //htmlDiff = htmlDiff.replace(/&lt;/g, '<');
                //htmlDiff = htmlDiff.replace(/&gt;/g, '>');
                let stampDiffFileName = path.resolve('tmp', id, timestamp.get() + '-diff.html');
                let tempDiffFileName = path.resolve('tmp', id, 'temp-diff.html');
                let expDiffFileName = path.resolve('tmp', id, 'exp-diff.html');

                fs.unlinkSync(oldFileName);
                fs.writeFileSync(oldFileName, newTxt);

                let pre = `<style>
                ins
                {
                    background:#AAFFAA;
                }
                del
                {
                    background:#FFAAAA;
                }
            </style>
            <style id='style'>
                del{display: none;}
            </style>
            <script>
                function showBefore()
                {
                    document.getElementById('style').innerText='ins{display:none}'
                }
                function showAfter()
                {
                    document.getElementById('style').innerText='del{display:none}'
                }
            </script>
            <div>
                <button onclick='showBefore()'>Before</button>
                <button onclick="showAfter()">After</button>
            </div>`
                htmlDiff = pre + htmlDiff;
                expDiff = pre + expDiff;

                fs.writeFileSync(stampDiffFileName, htmlDiff);

                if (fs.existsSync(tempDiffFileName))
                    fs.unlinkSync(tempDiffFileName);

                if (fs.existsSync(expDiffFileName))
                    fs.unlinkSync(expDiffFileName);
                fs.writeFileSync(expDiffFileName, expDiff);

                fs.copyFileSync(stampDiffFileName, tempDiffFileName);
                return true;
            }
        }
        else
        {
            if (!fs.existsSync(path.resolve('tmp', id)))
                fs.mkdirSync(path.resolve('tmp', id));

            let stampInitFileName = path.resolve('tmp', id, timestamp.get() + '-init.html');
            fs.writeFileSync(oldFileName, newTxt);
            fs.copyFileSync(oldFileName, stampInitFileName);
        }
        return false;
    }

    return { notice }
})();

let timestamp = (function ()
{
    /**@param {number} num
     * @returns {string}
     */
    function pad0(num)
    {
        if (num < 10)
            return '0' + num;
        else
            return num.toString();
    }

    return {
        get: function ()
        {
            let d1 = new Date();
            let yy = d1.getFullYear();
            let mo = pad0(d1.getMonth() + 1);
            let dd = pad0(d1.getDate());
            let hh = pad0(d1.getHours());
            let mi = pad0(d1.getMinutes());

            return yy + '-' + mo + '-' + dd + ' ' + hh + '.' + mi;
        }
    }
})();

let fetchers = (function ()
{
    async function runner()
    {
        try
        {

            const args = [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-infobars',
                '--window-position=0,0',
                '--ignore-certifcate-errors',
                '--ignore-certifcate-errors-spki-list',
                '--user-agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3312.0 Safari/537.36"'
            ];

            const browser = await puppeteer.launch({
                args,
                headless: true,
                ignoreHTTPSErrors: true,
                defaultViewport: {
                    width: 1920,
                    height: 1080
                }
            });

            let fetchers = [
                {
                    id: 'vfs-global',
                    fn: getVFSGlobal
                },
                {
                    id: 'vfs-german',
                    fn: getVFSCountry
                },
                {
                    id: 'german-embassy',
                    fn: getGermanEmbassy
                },
                {
                    id: 'german-vfs-slot',
                    fn: getSlots
                }
            ]

            // fetchers = [
            //     {
            //         id: 'test',
            //         fn: (browser) =>
            //         {
            //             return new Promise((resolve, reject) =>
            //             {
            //                 setTimeout(() =>
            //                 {
            //                     resolve('<div>test 3</div><div>test 4</div>');
            //                 }, 1000);
            //             })
            //         }
            //     }
            // ];

            //fetch all texts
            for (let ij = 0; ij < fetchers.length; ij++)
            {
                let fetcher = fetchers[ij];
                console.log('fetching : ' + fetcher.id);
                let txt1 = await fetcher.fn(browser);
                if (txt1 === null)
                    return false;
                fetcher.result = txt1;
            }

            let isAnyChange = false;
            let changeTxt = '';
            //notice all texts
            for (let ij = 0; ij < fetchers.length; ij++)
            {
                let fetcher = fetchers[ij];
                console.log('observering changes : ' + fetcher.id);
                let changed1 = observer.notice(fetcher.result, fetcher.id);
                if (changed1)
                {
                    isAnyChange = true;
                    changeTxt = fetcher.id + ' changed\n';
                    console.log('🟢 changes found : ' + fetcher.id);
                    require('child_process').exec('start ' + path.resolve('tmp', fetcher.id, 'temp-diff.html'));
                    require('child_process').exec('start ' + path.resolve('tmp', fetcher.id, 'exp-diff.html'));
                }
                else
                {
                    console.log('🔴 no changes : ' + fetcher.id);
                }
            }

            if (isAnyChange)
            {
                notify(changeTxt);
                notifyIFTTT(changeTxt);
            }

            await browser.close();
            return true;

        } catch (error)
        {
            debugger;
        }
        return false;
    }

    async function getVFSCountry(browser)
    {
        try
        {
            const page = await browser.newPage();
            await page.goto('https://visa.vfsglobal.com/ind/en/deu/');
            let news = await page.$eval('.search-results-latest-updates', ele => ele.outerHTML);
            await page.close();

            return news;
        } catch (error)
        {

        }
        return null;
    }

    async function getVFSGlobal(browser)
    {
        try
        {

            let page = await browser.newPage();
            await page.goto('https://www.vfsglobal.com/en/individuals/covid-19-customer-advisories.html');

            let fromType = '#main_content_container > div.wrapper.content_container.normal > ul > li > div:nth-child(2) > div > div.drp_form_wrapper > div.drp_container > div:nth-child(1) > div > div.input-wrapper > input';
            let fromClick = '#main_content_container > div.wrapper.content_container.normal > ul > li > div:nth-child(2) > div > div.drp_form_wrapper > div.drp_container > div:nth-child(1) > div > div.list-wrapper.show-list.show > ul > li:nth-child(1) > div > ul > li';

            let toType = '#main_content_container > div.wrapper.content_container.normal > ul > li > div:nth-child(2) > div > div.drp_form_wrapper > div.drp_container > div:nth-child(2) > div > div.input-wrapper > input';
            let toClick = '#main_content_container > div.wrapper.content_container.normal > ul > li > div:nth-child(2) > div > div.drp_form_wrapper > div.drp_container > div:nth-child(2) > div > div.list-wrapper.show-list.show > ul > li:nth-child(1) > div > ul > li';

            await page.type(fromType, 'India');
            await scheduler.sleep(1000);
            await page.click(fromClick);
            await scheduler.sleep(1000);

            await page.type(toType, 'Germany');
            await scheduler.sleep(1000);
            await page.click(toClick);
            await scheduler.sleep(1000);

            let news = await page.$eval('.covid_news_display', ele => ele.outerHTML);
            await page.close();
            return news;
        } catch (error)
        {

        }
        return null;
    }

    async function getGermanEmbassy(browser)
    {
        try
        {
            const page = await browser.newPage();
            await page.goto('https://india.diplo.de/visa');
            let news = await page.$eval('body', ele => ele.textContent);
            await page.close();


            return news;
        } catch (error)
        {

        }
        return null;
    }

    async function getSlots(browser)
    {
        let ret = '';
        try
        {

            const page = await browser.newPage();
            await page.goto('https://visa.vfsglobal.com/ind/en/deu/application-detail');
            let usernameSelector = '#Email';
            let passwordSelector = '#Password';
            let submitBtnSelector = '#btnLogin';

            console.log("Loggin in");
            await scheduler.sleep(1000);
            await page.type(usernameSelector, 'devarshi.hazarika@live.in');
            await scheduler.sleep(1000);
            await page.type(passwordSelector, 'BA9S53nZzp*iL3M');
            await scheduler.sleep(1000);
            await page.click(submitBtnSelector);

            await page.waitForNavigation();
            await page.goto('https://visa.vfsglobal.com/ind/en/deu/application-detail');

            console.log('Select center and visa type');
            let centerSelector = '#VisaApplicationCenterddl';

            await page.waitForSelector(centerSelector);
            await scheduler.sleep(5000);

            await page.select(centerSelector, 'DEL');



            let timeoutSecs = 60;
            let countUp = 0;

            while (true)
            {
                let visaType1Selector = '#VisaTypeddl';
                let visaType1List = await page.$$eval(visaType1Selector + '>option', arr => arr.map(it => ({ val: it.value, txt: it.innerHTML })));

                if (countUp++ >= timeoutSecs)
                {
                    throw 'Visa Type 1 didnt load';
                }

                if (visaType1List.length > 1)
                {
                    let visaType1OptionText = 'National Visa - More than 90 days';
                    ret += `Visa Type 1:\n` + visaType1List.map(x => x.txt).join('\n') + '\n';


                    if (visaType1List.map(x => x.txt).indexOf(visaType1OptionText) >= 0)
                    {
                        let visaType1Value = visaType1List.filter(x => x.txt == visaType1OptionText)[0].val;
                        await page.select(visaType1Selector, visaType1Value);
                    }
                    else
                    {
                        return ret;
                    }

                    break;
                }

                await scheduler.sleep(1000);
            }

            countUp = 0;
            while (true)
            {
                let visaType2Selector = '#SubVisaCategoryOptions'
                let visaType2List = await page.$$eval(visaType2Selector + '>option', arr => arr.map(it => ({ val: it.value, txt: it.innerHTML })));

                if (countUp++ >= timeoutSecs)
                {
                    throw 'Visa Type 1 didnt load';
                }

                if (visaType2List.length > 1)
                {
                    await scheduler.sleep(5000);
                    let visaType2OptionText = 'Contract holders for highly qualified employment holding a binding approval letter (ZAV-Zustimmung) and Dependents';
                    ret += `Visa Type 2:\n` + visaType2List.map(x => x.txt).join('\n') + '\n';

                    if (visaType2List.map(x => x.txt).indexOf(visaType2OptionText) >= 0)
                    {
                        let visaType2Value = visaType2List.filter(x => x.txt == visaType2OptionText)[0].val
                        await page.select(visaType2Selector, visaType2Value);
                    }
                    else
                    {
                        return ret;
                    }

                    break;
                }

                await scheduler.sleep(1000);
            }

            console.log('Continue to form');
            await page.click('#btnApplicationDetailContinue');

            await page.waitForNavigation();

            console.log("Fill the form");
            await page.type('#forename_', 'Devarshi');
            await page.type('#lastName_', 'Hazarika');
            await page.select('#gender_', 'Male');
            await page.select('#nationality_', 'IND');
            await page.type('#dob_', '24/01/1992');
            await page.type('#passnum_', 'P644754');
            await page.type('#pexpirydate_', '21/02/2027');
            await page.type('#countryCode_', '91');
            await page.type('#phoneNumber_', '7042732281');
            await page.type('#Email_', 'devarshi.hazarika@live.in');

            console.log("Save form");
            await page.click('#btnSave');

            // #wait
            console.log("Continue to slot selection");
            await page.waitForSelector('#btnContinue');
            await scheduler.sleep(5000);

            await page.click('#btnContinue');
            await scheduler.sleep(5000);
            console.log("Noticing slots for this month");

            let legendsEle = await page.$$eval('#legendData li', els => els.map(el => el.textContent));
            let legendsMonth0 = legendsEle.map(x => x.trim()).join(',');
            ret += '\nMonth 0:\n' + legendsMonth0 + '\n\n';

            console.log("Go next month");
            await page.waitForSelector('[title="Next Month"]');
            await page.click('[title="Next Month"]');

            console.log("Noticing slots for next month");
            await scheduler.sleep(5000);
            legendsEle = await page.$$eval('#legendData li', els => els.map(el => el.textContent));
            let legendsMonth1 = legendsEle.map(x => x.trim()).join(',');
            ret += 'Month 1:\n' + legendsMonth1 + '\n\n';
            await page.close();

        } catch (error)
        {
            debugger;
            console.error(error);
        }
        return ret;
    }

    return { runner };


})();

let fn1 = console.log;
console.log = function ()
{
    let arg1 = [timestamp.get()];
    for (var i = 0; i < arguments.length; i++)
    {
        arg1.push(arguments[i]);
    }

    fn1.apply(this, arg1);
}


console.log('begin observer');
let isRunning = false;


setInterval(async () =>
{
    if (isRunning)
        return;

    let shouldRun = (scheduler.shouldRun())
    if (shouldRun)
    {
        isRunning = true;
        let didRun = await fetchers.runner();
        if (didRun)
        {
            scheduler.hasRan();
        }
        else
        {
            scheduler.hasNotRun();
            console.log('failed');
        }
        isRunning = false;
    }
}, 60000);

process.on('uncaughtException', function (err)
{
    console.log('Uncaught exception: ' + err);
});

function notifyIFTTT(id)
{
    const https = require('https');
    let data = JSON.stringify({
        value1: id
    });
    let req = https.request({
        hostname: 'maker.ifttt.com',
        port: 443,
        path: '/trigger/observer/with/key/MGDKQKiAgIDdzj9ZVSmd7',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length
        },
    }, res =>
    {
        let data = '';
        res.on('data', chunk => { data += chunk });
        res.on('end', () =>
        {
            console.log(data);
        })
    })
    req.write(data);
    req.end();
}