/* eslint-disable */
const chai = require('chai');
const path = require('path');
const { exec } = require('child_process');
const { schoolModel } = require('../../../src/services/school/model');
const { newsModel } = require('../../../src/services/news/model');


const { expect } = chai;

function runWorker() {
    return new Promise((resolve, reject) => {
        const child = exec(
            `node ${path.join(__dirname, '../../../src/jobs/rss-news.js')}`,
            { env: { ...process.env } },
        );

        child.on('exit', resolve);
        child.on('error', reject);
    });
}

describe('RSS Feed Crawler Integration', function () {
    this.timeout(10000)
    let sampleSchool;
    let dbRSSNews;
    const sampleRSSFeed = {
        url: 'https://hpi.de/nc/rss.xml',
        description: 'HPI News',
    };

    before(async function () {
        sampleSchool = (await schoolModel.findOneAndUpdate(
            {},
            { $set: { rssFeeds: [sampleRSSFeed] } },
            { new: true },
        )).toObject();

    });

    beforeEach(runWorker);

    it('should create new news items based on schools rss feeds', async () => {
        dbRSSNews = (await newsModel.findOne({ source: 'rss' })).toObject();
        expect(dbRSSNews).to.exist;
        expect(dbRSSNews.sourceDescription).to.equal(sampleRSSFeed.description);
        expect(dbRSSNews.source).to.equal('rss');
        expect(dbRSSNews.externalId).to.exist;
    });

    it('should set rssFeed status to success', async () => {
        const school = (await schoolModel.findById(sampleSchool._id)).toObject();

        const successRSSFeed = school.rssFeeds.find(el => el.url === sampleRSSFeed.url);
        expect(successRSSFeed.status).to.equal('success');
    });

    describe('Invalid RSS Feeds', async () => {
        const invalidFeed = {
            url: 'blob',
            description: 'blub',
        };

        before(async () => {
            await schoolModel.findByIdAndUpdate(sampleSchool._id, { $push: { rssFeeds: invalidFeed } });
        });

        it('should set rssFeed status to error for invalid urls', async () => {
            const school = (await schoolModel.findById(sampleSchool._id)).toObject();

            const errorRSSFeed = school.rssFeeds.find(el => el.url === invalidFeed.url);
            expect(errorRSSFeed.status).to.equal('error');
        });
    });

    describe('Override changed news', () => {
        const changedContent = 'test';
        before(async () => {
            dbRSSNews = await newsModel.findByIdAndUpdate(
                dbRSSNews._id,
                { content: changedContent },
                { new: true },
            );
        });

        it('should override changed news', async () => {
            dbRSSNews = await newsModel.findById(dbRSSNews._id);
            expect(dbRSSNews.content).to.not.equal(changedContent);
        });
    });
    describe('Delete manually created rss news', () => {
        let manualNewsId;
        before(async () => {
            const manualNews = await new newsModel({
                title: 'a',
                content: 'a',
                schoolId: sampleSchool._id,
                source: 'rss',
            }).save();

            manualNewsId = manualNews._id;
        });

        it('should remove manually created news items', async () => {
            const manualNews = await newsModel.findById(manualNewsId);
            expect(manualNews).to.not.exist;
        });
    });

    describe('Delete removed News items from removed rss feeds', () => {
        before(async () => {
            await schoolModel.findByIdAndUpdate(sampleSchool._id, { rssFeeds: [] });
        });

        it('should remove news items from deleted rss feeds', async () => {
            const rssNewsCount = await newsModel.count({ source: 'rss' });
            expect(rssNewsCount).to.equal(0);
        });
    });
});
