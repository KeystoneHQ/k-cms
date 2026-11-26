const { spawn } = require('child_process');

function runCommand(command) {
  return new Promise((resolve, reject) => {
    const options = {
      shell: true
    };

    const child = spawn(command, options);

    child.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`);
    });

    child.stderr.on('data', (data) => {
      console.error(`stderr: ${data}`);
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Script exited with code ${code}`));
      } else {
        resolve();
      }
    });
  });
}

const commands = [
  'dotenv -- cross-var docu-notion -n "%DOCU_NOTION_INTEGRATION_TOKEN%" -r "%DOCU_NOTION_DOCS_ROOT_PAGE_EN%" -t "%AVAILABLE_STATUS%"',
  'dotenv -- cross-var docu-notion -n "%DOCU_NOTION_INTEGRATION_TOKEN%" -r "%DOCU_NOTION_DOCS_ROOT_PAGE_HANT%" -m i18n/zh/docusaurus-plugin-content-docs/current -t "%AVAILABLE_STATUS%"',
];

(async () => {
  try {
    for (const command of commands) {
      await runCommand(command);
    }
    console.log('All commands executed successfully');
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
})();