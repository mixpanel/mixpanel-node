const Mixpanel = require('../lib/mixpanel-node');

describe('alias', () => {
    let mixpanel;
    let sendRequestMock;
    beforeEach(() => {
        mixpanel = Mixpanel.init('token', { key: 'key' });
        vi.spyOn(mixpanel, 'send_request');
        return () => {
          mixpanel.send_request.mockRestore();
        };
    });

    it("calls send_request with correct endpoint and data", () => {
        var alias = "test",
            distinct_id = "old_id",
            expected_endpoint = "/track",
            expected_data = {
                event: '$create_alias',
                properties: expect.objectContaining({
                    distinct_id: distinct_id,
                    alias: alias,
                    token: 'token',
                }),
            };

        mixpanel.alias(distinct_id, alias);

        expect(mixpanel.send_request).toHaveBeenCalledWith(
            expect.objectContaining({
              endpoint: expected_endpoint,
              data: expected_data,
            }),
            undefined,
        );
    });
});
