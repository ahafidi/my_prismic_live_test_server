const fsPromises = require('fs').promises
const express = require('express')
const cors = require('cors')
const groupBy = require('lodash').groupBy

const app = express()

let logs = []
let repositories = []
let plots = {}

const computePlots = () => {
  repositories.map(repository => {
    const repositoryLogs = logs.reduce((acc, cv, i) => {
      const {
        http_host,
        '@timestamp': timestamp,
        bytes,
      } = cv

      if (http_host === `${repository}.prismic.io`) {
        const d = new Date(timestamp)
        if (d instanceof Date && !isNaN(d)) { // is a valid date
          return [
            ...acc,
            {
              time: d,
              bytes,
            },
          ]
        }
      }

      return acc
    }, [])

    const aggreationDates = groupBy(repositoryLogs, e => e.time.toISOString().split('T')[0])

    const repositoryPlot = []

    Object.keys(aggreationDates).map(i => repositoryPlot.push({
        time: i,
        bytes: aggreationDates[i].reduce((acc, cv) => acc + parseInt(cv.bytes), 0),
      })
    )

    plots[repository] = repositoryPlot
  })
}

const main = async () => {
  try {
    const data = await fsPromises.readFile('logs.json', 'utf8')
    logs = Array.from(JSON.parse(data))
  } catch (e) {
    console.error(e)
    return
  }

  const set = new Set()

  logs.map(({ http_host }) => set.add(http_host.split('.')[0]))

  repositories = Array.from(set)

  computePlots()
}

main()

app.use(cors({
  origin: 'http://localhost:3000',
}))

app.get('/repositories', (req, res) => {
  return res.json(repositories)
})

app.get('/:repository', (req, res, next) => {
  const repository = req.params.repository

  const plot = plots[repository]

  if (plot) {
    return res.json(plot)
  }

  next()
})

app.use((req, res) => res.status(404).send('404 error'))

app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).send('500 error')
})

const server = app.listen(4242, () => {
  console.log(`Server running at localhost:${server.address().port}`)
})
