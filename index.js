const app_name = 'wixish'
const os = require('node:os')
const child_process = require('node:child_process')
const fs = require('node:fs')
const readlinePromises = require('node:readline/promises');
const rl = readlinePromises.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function nginx_fail() {
  console.log('nginx sites-enabled folder not found')
  process.exit(0)
}

const CONSTANTS = {
  root_path: `/var/www/${app_name}`
}

function setup(path) {
  console.log('setup path is ' + path)

  fs.mkdirSync(path)
  fs.cpSync('client', `${path}/dist`, { recursive: true })
  fs.writeFileSync(`${path}/is_wixish_true`, '')

  console.log('setup completed')
}

function handle_not_enoent(error) {
  if (error.code !== 'ENOENT') {
    console.log('Unknown error occured please send below lines to developer')
    console.log(error)
    process.exit(1)
  }
}

async function main() {
  console.log('Press \'Ctrl + C\' twice to exit')

  try {
    child_process.execSync('certbot --version', { encoding: 'utf-8' })
  } catch (error) {
    console.log('certbot is not installed or not in $PATH.')
    process.exit(0)
  }

  let root_path = CONSTANTS.root_path
  try {
    const files = fs.readdirSync(root_path)
    if (files.includes('is_wixish_true'))
      return

    console.log(`The root folder '${root_path}' cant use for ${app_name}. Please enter root path for setup.`)
    console.log(`Make sure path is not exists or enter ${root_path} to set root path forcefully`)

    root_path = (await rl.question('Root path: ')).trim()
    if (root_path.slice(-1) === '/')
      root_path = root_path.slice(0, -1)

    try {
      if (root_path === CONSTANTS.root_path) {
        setup(root_path)
        return
      }

      const stat = fs.statSync(root_path)
      if (stat) {
        console.log('Entered folder is not empty')
        process.exit(1)
      }

    } catch (error) {
      handle_not_enoent(error)
      setup(root_path)
    }
  } catch (error) {
    handle_not_enoent(error)
    setup(root_path)
  }
  finally {
    let nginx_path = (await rl.question('Enter nginx sites-enabled folder (press enter to apply /etc/nginx/sites-enabled): ')).trim() || '/etc/nginx/sites-enabled'

    const stat = await fs.promises.stat(nginx_path)
      .catch(nginx_fail)

    if (!stat.isDirectory())
      nginx_fail()

    const [domain, ...subdomains] = await (await rl.question('Domain names (non subdomain first) (eg: example.com www.example.com): ')).trim().split(' ')
    const domains = subdomains.join(' ')
    console.log(domain, subdomains, domains)

    const domain_conf = fs.readFileSync('./domain.conf', { encoding: 'utf-8' })
      .replace('string_to_be_changed_server_name', `${domain}${domains ? ' ' + domains : ''}`)
      .replace('string_to_be_changed_root', `${root_path}/dist`)

    fs.writeFileSync(nginx_path + '/' + domain + '.conf', domain_conf)

    let command = `certbot --nginx -d ${domain} `
    if (os.platform() !== 'win32')
      command = 'sudo ' + command

    if (domains) {
      for (const domain of subdomains)
        command += `-d ${domain} `
    }

    command += ' --non-interactive --agree-tos -m webmaster@google.com'
    console.log(command)

    const certbot = child_process.execSync(command, { encoding: 'utf-8' })
    console.log('------')
    console.log(certbot)
    console.log('------')

    console.log('Application successfully installed')

    process.exit(0)
  }


}

// console.log('nginx sites-enabled folder not found')
// process.exit(0)

main()