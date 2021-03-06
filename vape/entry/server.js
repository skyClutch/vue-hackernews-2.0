import { createApp } from '../app'

const isDev = process.env.NODE_ENV !== 'production'

// This exported function will be called by `bundleRenderer`.
// This is where we perform data-prefetching to determine the
// state of our application before actually rendering it.
// Since data fetching is async, this function is expected to
// return a Promise that resolves to the app instance.
export default context => {
  return createApp()
  .then(({ app, router, store }) => {
    return new Promise((resolve, reject) => {
      const s = isDev && Date.now()

      const { url } = context
      const fullPath = router.resolve(url).route.fullPath

      if (fullPath !== url) {
        reject({ url: fullPath })
      }

      // set router's location
      router.push(url)

      // get a fresh set of the pages on every server load

      // wait until router has resolved possible async hooks
      router.onReady(() => {
        const matchedComponents = router.getMatchedComponents()
        // no matched routes
        if (!matchedComponents.length) {
          reject({ code: 404 })
        }
        // Call fetchData hooks on components matched by the route.
        // A preFetch hook dispatches a store action and returns a Promise,
        // which is resolved when the action is complete and store state has been
        // updated.
        Promise.all(matchedComponents.map(Component => {
          const ComponentData = Component.data || (() => ({}))
          const asyncData = Component.asyncData

          if (!asyncData)
            return {}

          return asyncData && asyncData({
            store,
            route: router.currentRoute
          })
          .then(asyncResult => {
            Component.data = function () {
              const data =  ComponentData.call(this)
              return Object.assign(data, asyncResult)
            }
            if (Component._Ctor && Component._Ctor[0] && Component._Ctor[0].options) {
              Component._Ctor[0].options.data = Component.data
            }
            return null
          })
        }))
        .then(() => {
          isDev && console.log(`data pre-fetch: ${Date.now() - s}ms`)
          // After all preFetch hooks are resolved, our store is now
          // filled with the state needed to render the app.
          // Expose the state on the render context, and let the request handler
          // inline the state in the HTML response. This allows the client-side
          // store to pick-up the server-side state without having to duplicate
          // the initial data fetching on the client.
          context.state = store.state
          resolve(app)
        }).catch(reject)
      }, reject)
    })
  })
}
