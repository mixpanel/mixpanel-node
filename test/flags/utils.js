const { expect } = require('chai');
const {
    generateTraceparent,
    normalizedHash
} = require('../../lib/flags/utils');

describe('Utils', function() {
    describe('generateTraceparent', function() {
        it('should generate traceparent in W3C format', function() {
            const traceparent = generateTraceparent();
            // W3C format: 00-{32 hex chars}-{16 hex chars}-01
            const pattern = /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/;
            expect(traceparent).to.match(pattern);
        });
    });

    describe('normalizedHash', function() {
        it('should match known test vectors', function() {
            const hash1 = normalizedHash("abc", "variant");
            expect(hash1).equals(0.72)

            const hash2 = normalizedHash("def", "variant");
            expect(hash2).equals(0.21, 0.01);
        });
    });
});
