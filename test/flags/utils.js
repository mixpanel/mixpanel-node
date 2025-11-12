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
        const expectValidHash = (hash) => {
            expect(hash).to.be.a('number');
            expect(hash).to.be.at.least(0);
            expect(hash).to.be.at.most(1);
        };

        it('should match known test vectors', function() {
            const hash1 = normalizedHash("abc", "variant");
            expect(hash1).equals(0.72)

            const hash2 = normalizedHash("def", "variant");
            expect(hash2).equals(0.21, 0.01);
        });

        it('should produce consistent results', function() {
            const hash1 = normalizedHash("test_key", "salt");
            const hash2 = normalizedHash("test_key", "salt");
            const hash3 = normalizedHash("test_key", "salt");

            expect(hash1).equals(hash2);
            expect(hash2).equals(hash3);
        });

        it('should produce different hashes when salt is changed', function() {
            const hash1 = normalizedHash("same_key", "salt1");
            const hash2 = normalizedHash("same_key", "salt2");
            const hash3 = normalizedHash("same_key", "different_salt");

            expect(hash1).to.not.equal(hash2);
            expect(hash1).to.not.equal(hash3);
            expect(hash2).to.not.equal(hash3);
        });

        it('should produce different hashes when order is changed', function() {
            const hash1 = normalizedHash("abc", "salt");
            const hash2 = normalizedHash("bac", "salt");
            const hash3 = normalizedHash("cba", "salt");

            expect(hash1).to.not.equal(hash2);
            expect(hash1).to.not.equal(hash3);
            expect(hash2).to.not.equal(hash3);
        });

        describe('should handle edge cases with empty strings', function() {
            const testCases = [
                { key: "", salt: "salt", description: "empty key" },
                { key: "key", salt: "", description: "empty salt" },
                { key: "", salt: "", description: "both empty" }
            ];

            testCases.forEach(({ key, salt, description }) => {
                it(`should return valid hash for ${description}`, function() {
                    const hash = normalizedHash(key, salt);
                    expectValidHash(hash);
                });
            });

            it('empty strings in different positions should produce different results', function() {
                const hash1 = normalizedHash("", "salt");
                const hash2 = normalizedHash("key", "");
                expect(hash1).to.not.equal(hash2);
            });
        });

        describe('should handle special characters', function() {
            const testCases = [
                { key: "🎉", description: "emoji" },
                { key: "beyoncé", description: "accented characters" },
                { key: "key@#$%^&*()", description: "special symbols" },
                { key: "key with spaces", description: "spaces" }
            ];

            testCases.forEach(({ key, description }) => {
                it(`should return valid hash for ${description}`, function() {
                    const hash = normalizedHash(key, "salt");
                    expectValidHash(hash);
                });
            });

            it('produces different results for different special characters', function() {
                const hashes = testCases.map(tc => normalizedHash(tc.key, "salt"));

                for (let i = 0; i < hashes.length; i++) {
                    for (let j = i + 1; j < hashes.length; j++) {
                        expect(hashes[i]).to.not.equal(hashes[j]);
                    }
                }
            });
        });
    });
});
