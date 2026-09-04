let appPromise;

async function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      const [{ createApp }, { createStore }] = await Promise.all([
        import('../backend/dist/app.js'),
        import('../backend/dist/store.js'),
      ]);
      const store = await createStore(process.env);
      return createApp(store, process.env);
    })();
  }
  return appPromise;
}

export default async function handler(req, res) {
  const app = await getApp();
  return app(req, res);
}
