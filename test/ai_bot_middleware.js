// test/ai_bot_middleware.js

describe('AI Bot Middleware Integration', () => {

  let Mixpanel, mixpanel;

  beforeEach(() => {
    Mixpanel = require('../lib/mixpanel-node');
  });

  describe('enable_bot_classification', () => {

    it('should enrich track() calls with bot classification when $user_agent is present', () => {
      const { enable_bot_classification } = require('../lib/ai_bot_middleware');
      mixpanel = Mixpanel.init('test-token');
      enable_bot_classification(mixpanel);

      vi.spyOn(mixpanel, 'send_request');

      mixpanel.track('page_view', {
        distinct_id: 'user123',
        $user_agent: 'Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)'
      });

      expect(mixpanel.send_request).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            properties: expect.objectContaining({
              $is_ai_bot: true,
              $ai_bot_name: 'GPTBot',
              $ai_bot_provider: 'OpenAI',
              $ai_bot_category: 'indexing'
            })
          })
        }),
        undefined
      );
    });

    it('should NOT add bot properties when $user_agent is not present', () => {
      const { enable_bot_classification } = require('../lib/ai_bot_middleware');
      mixpanel = Mixpanel.init('test-token');
      enable_bot_classification(mixpanel);

      vi.spyOn(mixpanel, 'send_request');

      mixpanel.track('page_view', { distinct_id: 'user123' });

      const callData = mixpanel.send_request.mock.calls[0][0].data;
      expect(callData.properties.$is_ai_bot).toBeUndefined();
    });

    it('should set $is_ai_bot:false when $user_agent is present but not an AI bot', () => {
      const { enable_bot_classification } = require('../lib/ai_bot_middleware');
      mixpanel = Mixpanel.init('test-token');
      enable_bot_classification(mixpanel);

      vi.spyOn(mixpanel, 'send_request');

      mixpanel.track('page_view', {
        distinct_id: 'user123',
        $user_agent: 'Mozilla/5.0 Chrome/120.0.0.0'
      });

      const callData = mixpanel.send_request.mock.calls[0][0].data;
      expect(callData.properties.$is_ai_bot).toBe(false);
      expect(callData.properties.$ai_bot_name).toBeUndefined();
    });

    it('should preserve existing properties alongside bot classification', () => {
      const { enable_bot_classification } = require('../lib/ai_bot_middleware');
      mixpanel = Mixpanel.init('test-token');
      enable_bot_classification(mixpanel);

      vi.spyOn(mixpanel, 'send_request');

      mixpanel.track('page_view', {
        distinct_id: 'user123',
        $user_agent: 'GPTBot/1.2',
        page_url: '/products',
        custom_prop: 'value'
      });

      const props = mixpanel.send_request.mock.calls[0][0].data.properties;
      expect(props.page_url).toBe('/products');
      expect(props.custom_prop).toBe('value');
      expect(props.$is_ai_bot).toBe(true);
    });

    it('should preserve callback functionality', () => {
      const { enable_bot_classification } = require('../lib/ai_bot_middleware');
      mixpanel = Mixpanel.init('test-token');
      enable_bot_classification(mixpanel);

      vi.spyOn(mixpanel, 'send_request');

      const callback = vi.fn();
      mixpanel.track('page_view', { $user_agent: 'GPTBot/1.2' }, callback);

      expect(mixpanel.send_request).toHaveBeenCalledWith(
        expect.anything(),
        callback
      );
    });

    it('should support callback as second argument (no properties)', () => {
      const { enable_bot_classification } = require('../lib/ai_bot_middleware');
      mixpanel = Mixpanel.init('test-token');
      enable_bot_classification(mixpanel);

      vi.spyOn(mixpanel, 'send_request');

      const callback = vi.fn();
      mixpanel.track('page_view', callback);

      // When callback is passed as 2nd arg, properties should be empty
      // and no bot classification should be added
      expect(mixpanel.send_request).toHaveBeenCalled();
    });

    it('should NOT enrich track_batch events (known limitation — track_batch bypasses send_event_request)', () => {
      const { enable_bot_classification } = require('../lib/ai_bot_middleware');
      mixpanel = Mixpanel.init('test-token');
      enable_bot_classification(mixpanel);

      vi.spyOn(mixpanel, 'send_request');

      mixpanel.track_batch([
        { event: 'page_view', properties: { $user_agent: 'GPTBot/1.2', distinct_id: 'bot1' } },
        { event: 'page_view', properties: { $user_agent: 'Chrome/120', distinct_id: 'user1' } }
      ]);

      // track_batch goes through send_batch_requests -> send_request, NOT send_event_request
      // so bot classification is not applied
      const call = mixpanel.send_request.mock.calls[0][0];
      expect(call.data[0].properties.$is_ai_bot).toBeUndefined();
      expect(call.data[1].properties.$is_ai_bot).toBeUndefined();
    });

    it('should not modify the original properties object', () => {
      const { enable_bot_classification } = require('../lib/ai_bot_middleware');
      mixpanel = Mixpanel.init('test-token');
      enable_bot_classification(mixpanel);

      vi.spyOn(mixpanel, 'send_request');

      const props = { distinct_id: 'user123', $user_agent: 'GPTBot/1.2' };
      const originalKeys = Object.keys(props);
      mixpanel.track('page_view', props);

      // Original object should not have been mutated
      expect(Object.keys(props).sort()).toEqual(originalKeys.sort());
    });
  });

  describe('configuration options', () => {

    it('should accept custom user_agent_property name', () => {
      const { enable_bot_classification } = require('../lib/ai_bot_middleware');
      mixpanel = Mixpanel.init('test-token');
      enable_bot_classification(mixpanel, {
        user_agent_property: 'ua_string'
      });

      vi.spyOn(mixpanel, 'send_request');

      mixpanel.track('page_view', {
        distinct_id: 'user123',
        ua_string: 'GPTBot/1.2'
      });

      const props = mixpanel.send_request.mock.calls[0][0].data.properties;
      expect(props.$is_ai_bot).toBe(true);
    });

    it('should accept custom property prefix', () => {
      const { enable_bot_classification } = require('../lib/ai_bot_middleware');
      mixpanel = Mixpanel.init('test-token');
      enable_bot_classification(mixpanel, {
        property_prefix: 'bot_'
      });

      vi.spyOn(mixpanel, 'send_request');

      mixpanel.track('page_view', {
        $user_agent: 'GPTBot/1.2'
      });

      const props = mixpanel.send_request.mock.calls[0][0].data.properties;
      expect(props.bot_is_ai_bot).toBe(true);
      expect(props.bot_name).toBe('GPTBot');
    });

    it('should allow disabling classification without removing middleware', () => {
      const { enable_bot_classification } = require('../lib/ai_bot_middleware');
      mixpanel = Mixpanel.init('test-token');
      const controller = enable_bot_classification(mixpanel);

      vi.spyOn(mixpanel, 'send_request');

      controller.disable();
      mixpanel.track('page_view', { $user_agent: 'GPTBot/1.2' });

      const props = mixpanel.send_request.mock.calls[0][0].data.properties;
      expect(props.$is_ai_bot).toBeUndefined();

      controller.enable();
      mixpanel.track('page_view', { $user_agent: 'GPTBot/1.2' });

      const props2 = mixpanel.send_request.mock.calls[1][0].data.properties;
      expect(props2.$is_ai_bot).toBe(true);
    });
  });

  describe('helper: track_request', () => {

    it('should provide a helper that extracts user-agent from HTTP request', () => {
      const { enable_bot_classification, track_request } = require('../lib/ai_bot_middleware');
      mixpanel = Mixpanel.init('test-token');
      enable_bot_classification(mixpanel);

      vi.spyOn(mixpanel, 'send_request');

      // Simulate an Express/Node.js request object
      const mockReq = {
        headers: {
          'user-agent': 'GPTBot/1.2',
          'x-forwarded-for': '1.2.3.4'
        },
        ip: '1.2.3.4',
        url: '/api/products'
      };

      track_request(mixpanel, mockReq, 'page_view', {
        distinct_id: 'user123',
        page_url: '/api/products'
      });

      const props = mixpanel.send_request.mock.calls[0][0].data.properties;
      expect(props.$user_agent).toBe('GPTBot/1.2');
      expect(props.$is_ai_bot).toBe(true);
      expect(props.ip).toBe('1.2.3.4');
      expect(props.page_url).toBe('/api/products');
    });

    it('should handle request with no user-agent header', () => {
      const { enable_bot_classification, track_request } = require('../lib/ai_bot_middleware');
      mixpanel = Mixpanel.init('test-token');
      enable_bot_classification(mixpanel);

      vi.spyOn(mixpanel, 'send_request');

      const mockReq = { headers: {}, ip: '1.2.3.4' };
      track_request(mixpanel, mockReq, 'page_view', { distinct_id: 'user123' });

      const props = mixpanel.send_request.mock.calls[0][0].data.properties;
      expect(props.$is_ai_bot).toBeUndefined();
    });
  });
});
