'use strict'
const path = require('path')
const meow = require('meow')
const { pullAt, merge, omit } = require('lodash')
const chalk = require('chalk')
const updateNotifier = require('update-notifier')
const readPkg = require('read-pkg')
const writePkg = require('write-pkg')
const dotProp = require('dot-prop')
const pkgDep = require('pkg-dep')
const install = require('npm-install-package')
const ora = require('ora')
const logSymbols = require('log-symbols')

const log = console.log
const cwd = process.cwd

class HuskyConf {
  constructor () {
    this.alias = ['i', 'a', 'r', 'v']
    this.command = ['init', 'add', 'remove', 'version']

    this.hooks = [
      'applypatch-msg',
      'commit-msg',
      'post-applypatch',
      'post-checkout',
      'post-commit',
      'post-merge',
      'post-receive',
      'post-rewrite',
      'post-update',
      'pre-applypatch',
      'pre-auto-gc',
      'pre-commit',
      'pre-push',
      'pre-rebase',
      'pre-receive',
      'prepare-commit-msg',
      'push-to-checkout',
      'update'
    ]
    this.cli = meow(`
        ${chalk.yellow('Usage')}:
          $ ${chalk.green('husky-conf <option>')}

        ${chalk.yellow('Options')}:
            ${this.command[0]}    ${this.command[0].charAt(0)}  Initialize husky
            ${this.command[1]}    ${this.command[1].charAt(0)}  Add husky hook
            ${this.command[2]}    ${this.command[2].charAt(0)}  Remove existing husky hook
            ${this.command[3]}    ${this.command[3].charAt(0)}  Check version of husky-conf

        ${chalk.yellow('Examples')}:
          $ husky-conf --help
          $ husky-conf version
          $ husky-conf init 
          $ husky-conf add commit-msg
          $ husky-conf remove commit-msg
    `, {
      string: ['_'],
      alias: {
        i: 'init',
        a: 'add',
        r: 'remove'
      },
      flags: {
        init: {
          type: 'array',
          default: true
        },
        add: {
          type: 'string',
          default: false
        },
        remove: {
          type: 'string',
          default: false
        },
        version: {
          type: 'string',
          default: false
        }
      }
    })

    if (this.cli.input.length === 0) {
      log(logSymbols.error, chalk.red('Specify at least one path'))
      process.exit(1)
    } else {
      const val = pullAt(this.cli.input, [0, 1])
      this.setup(val[0], val[1])
    }

    this.updateNotify()
  }

  updateNotify () {
    updateNotifier({ pkg: this.cli.pkg }).notify()
  }

  removeDash (value) {
    return value.replace(/-/g, '')
  }

  checkHuskyExists () {
    return pkgDep.hasSync('husky')
  }

  async installHusky () {
    await new Promise((resolve, reject) => {
      const spinner = ora('Husky installing ...').start()
      install('husky@next', function (err) {
        if (err) {
          spinner.fail('Failed to install')
          reject(err)
        } else {
          spinner.succeed('Husky successfully installed')
          resolve(true)
        }
      })
    })
  }

  async version () {
    await readPkg(__dirname).then(pkg => {
      log(logSymbols.info, `husky-conf ${chalk.green('v') + chalk.green(dotProp.get(pkg, 'version'))}`)
    })
  }

  add (value) {
    if (this.hooks.indexOf(value) < 0) {
      log(logSymbols.error, chalk.red('Invalid hook'))
    } else {
      readPkg(cwd()).then(pkg => {
        const scriptObj = {}
        const huskyObj = {}

        scriptObj[this.removeDash(value)] = 'npm run test'
        huskyObj[value] = `npm run ${this.removeDash(value)}`

        writePkg(
          path.join(cwd(), 'package.json'),
          omit(
            merge(
              pkg,
              dotProp.set(pkg, 'scripts', dotProp.has(pkg, 'scripts') ? merge(dotProp.get(pkg, 'scripts'), Object.assign({}, scriptObj)) : merge(Object.assign({
                'test': 'echo \'Error: no test specified\' && exit 1'
              }, scriptObj))),
              dotProp.set(pkg, 'husky.hooks', dotProp.has(pkg, 'husky') ? merge(dotProp.get(pkg, 'husky.hooks'), huskyObj) : huskyObj)
            ),
            '_id'
          )
        ).then(pkg => {
          log(logSymbols.success, chalk.green(`${value} added into husky hooks as well as npm script`))
        }).catch(error => {
          log(logSymbols.error, chalk.red(error))
        })
      }).catch(error => {
        log(logSymbols.error, chalk.red(error))
      })
    }
  }

  remove (value) {
    if (this.hooks.indexOf(value) < 0) {
      log(logSymbols.error, chalk.red('Invalid hook'))
    } else {
      readPkg(cwd()).then(pkg => {
        writePkg(
          path.join(cwd(), 'package.json'),
          omit(
            Object.assign(
              dotProp.set(
                pkg,
                'husky.hooks',
                omit(
                  dotProp.get(pkg, 'husky.hooks'),
                  value
                )
              ),
              dotProp.set(
                pkg,
                'scripts',
                omit(
                  dotProp.get(pkg, 'scripts'),
                  this.removeDash(value)
                )
              )
            ),
            '_id'
          )
        )
      }).then(pkg => {
        log(logSymbols.success, chalk.green(`${value} removed from husky hooks as well as npm script`))
      }).catch(error => {
        log(logSymbols.error, chalk.red(error))
      })
    }
  }

  init () {
    readPkg(cwd()).then(pkg => {
      const huskyExists = dotProp.get(pkg, 'husky')
      if (huskyExists) {
        log(logSymbols.success, chalk.green('Husky already exists'))
      } else {
        const _scripts = dotProp.has(pkg, 'scripts') ? dotProp.set(
          merge(
            dotProp.get(pkg, 'scripts'),
            { 'precommit': 'npm test' }
          )
        ) : {
          'test': 'echo \'Error: no test specified\' && exit 1',
          'precommit': 'npm test'
        }

        writePkg(
          path.join(cwd(), 'package.json'),
          omit(Object.assign(
            pkg,
            {
              'scripts': _scripts,
              'husky': {
                'hooks': {
                  'pre-commit': 'npm run precommit'
                }
              }
            }
          ), '_id')
        ).then(pkg => {
          log(logSymbols.success, chalk.green('Husky setup completed'))
        }).catch(error => {
          log(logSymbols.error, chalk.red(error))
        })
      }
    }).catch(error => {
      log(logSymbols.error, chalk.red(error))
    })
  }

  setup (input, value) {
    if (this.command.indexOf(input) > -1 || this.alias.indexOf(input) > -1) {
      if (input === 'init' || input === 'i') {
        if (this.checkHuskyExists()) {
          this.init()
        } else {
          this.installHusky().then(() => {
            this.init()
          }).catch(err => log(logSymbols.error, chalk.red(err)))
        }
      } else if (input === 'remove' || input === 'r') {
        this.remove(value)
      } else if (input === 'add' || input === 'a') {
        if (this.checkHuskyExists()) {
          this.add(value)
        } else {
          this.installHusky().then(() => {
            this.add(value)
          }).catch(err => log(logSymbols.error, chalk.red(err)))
        }
      } else if (input === 'version' || input === 'v') {
        this.version()
      }
    } else {
      log(logSymbols.error, chalk.red('Command not valid'))
    }
  }
}

module.exports = Object.assign(new HuskyConf(), { HuskyConf })
