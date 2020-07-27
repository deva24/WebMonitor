const fs = require('fs');
const path = require('path');
const Diff = require('text-diff');
const puppeteer = require('puppeteer');
const { notify } = require('node-notifier');



if (!fs.existsSync('tmp'))
{
    fs.mkdirSync('tmp');
}

let scheduler = (function ()
{
    let filename = path.resolve('tmp', 'schedule.json');

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
        let obj = getNow();
        fs.writeFileSync(filename, JSON.stringify(obj));
    }

    function shouldRun()
    {
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
        let nowRun = getNow();
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

    return { getLastRun, getNow, hasRan, shouldRun, sleep }
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
                let stampDiffFileName = path.resolve('tmp', id, timestamp.get() + '-diff.html');

                fs.unlinkSync(oldFileName);
                fs.writeFileSync(oldFileName, newTxt);

                htmlDiff = `<style>
                    ins
                    {
                        background:#AAFFAA;
                    }
                    del
                    {
                        background:#FFAAAA;
                    }
                </style>` + htmlDiff;
                fs.writeFileSync(stampDiffFileName, htmlDiff);
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
    return {
        get: function ()
        {
            return new Date().toISOString()
                .replace(/T/, ' ')
                .replace(/\..+/, '')
                .replace(/:/g, '.');
        }
    }
})();

let fetcher = (function ()
{
    async function runner()
    {
        try
        {
            const browser = await puppeteer.launch({
                headless: false,
                defaultViewport: {
                    width: 1920,
                    height: 1080
                }
            });

            console.log('fetch VFS Global');
            let txt1 = await getVFSGlobal(browser);
            if (txt1 === null)
            {
                console.log('failed fetching VFS Global');
                return false;
            }

            console.log('fetch VFS country');
            let txt2 = await getVFSCountry(browser);
            if (txt2 === null)
            {
                console.log('failed fetching VFS country');
                return false;
            }

            console.log("fetch successful, observing changes");

            let changed1 = await observer.notice(txt1, 'vfs-global');
            let changed2 = await observer.notice(txt2, 'vfs-german');

            if (changed1 && !changed2)
            {
                notify('vfs global changed');
            }
            else if (!changed1 && changed2)
            {
                notify('vfs german changed');
            }
            else if (changed1 && changed2)
            {
                notify('vfs global & german has changed');
            }
            await browser.close();
            return true;

        } catch (error)
        {

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

    return { runner };

})();

(async () =>
{
    let isRunning = false;

    setTimeout(async () =>
    {
        if (isRunning)
            return;

        if (scheduler.shouldRun())
        {
            isRunning = true;
            let didRun = await fetcher.runner();

            if (didRun)
            {
                scheduler.hasRan();
            }
            isRunning = false;
        }


    }, 1000);

})();