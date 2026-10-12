jest.mock('throng', () =>
    jest.fn(async options => {
        if (options && typeof options.worker === 'function') {
            await options.worker(1, jest.fn());
        }
    }),
);

jest.mock('../app', () => ({
    listen: jest.fn((port, callback) => {
        if (callback) {
            callback();
        }
    }),
}));

describe('server', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    it('starts the HTTP listener via the throng worker', async () => {
        require('../server');
        const app = require('../app');
        expect(app.listen).toHaveBeenCalled();
        const [portArg, cb] = app.listen.mock.calls[0];
        expect(typeof portArg).toBe('number');
        expect(typeof cb).toBe('function');
    });
});
