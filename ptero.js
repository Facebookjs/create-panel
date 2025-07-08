const axios = require('axios');
const path = require('path');
const fs = require('fs');

// Ambil settings.json dari root
const settingsPath = path.join(__dirname, '../../settings.json');
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

// Ambil variabel konfigurasi
const domain = settings.ptero_domain;
const apikeyptero = settings.ptero_api_key;
const capikeyptero = settings.ptero_capikey;

class PteroCreate {
  constructor(domain, apikey) {
    this.domain = domain;
    this.headers = {
      'Authorization': `Bearer ${apikey}`,
      'Content-Type': 'application/json',
      'Accept': 'Application/vnd.pterodactyl.v1+json'
    };
  }

  async getEggStartup(nestId, eggId) {
    const url = `${this.domain}/api/application/nests/${nestId}/eggs/${eggId}`;
    const res = await axios.get(url, { headers: this.headers });
    return res.data.attributes;
  }

  async createUser(email, username, password) {
    const url = `${this.domain}/api/application/users`;
    const payload = {
      email,
      username,
      first_name: 'Auto',
      last_name: 'User',
      password,
    };
    const res = await axios.post(url, payload, { headers: this.headers });
    return res.data.attributes;
  }

  async createServer(data) {
    const url = `${this.domain}/api/application/servers`;
    const res = await axios.post(url, data, { headers: this.headers });
    return res.data.attributes;
  }
}

function generatePassword(length = 12) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

module.exports = function (app) {
  app.get('/create/ptero', async (req, res) => {
    const { apikey, nameserver, disk } = req.query;

    if (!global.apikey?.includes(apikey)) {
      return res.json({
        status: false,
        creator: 'Vanzz Ryuichi',
        error: 'Apikey tidak valid!'
      });
    }

    if (!nameserver || !disk) {
      return res.json({
        status: false,
        creator: 'Vanzz Ryuichi',
        error: 'Semua parameter wajib diisi!'
      });
    }

    const parsedDisk = parseInt(disk);

    if (isNaN(parsedDisk)) {
      return res.json({
        status: false,
        creator: 'Vanzz Ryuichi',
        error: 'Disk harus berupa angka!'
      });
    }

    if (parsedDisk !== 0 && (parsedDisk < 1000 || parsedDisk > 10000)) {
      return res.json({
        status: false,
        creator: 'Vanzz Ryuichi',
        error: 'Disk hanya boleh antara 1000 - 10000 MB atau 0 (unlimited)'
      });
    }

    // ✅ CPU Otomatis Berdasarkan Disk
    let cpu;
    if (parsedDisk === 0) {
      cpu = 10000; // Unlimited
    } else {
      cpu = Math.floor(parsedDisk / 1000) * 40;
      if (cpu < 220) cpu = 220;
      if (cpu > 300) cpu = 300;
    }

    const nestid = 5;
    const eggid = 15;
    const locid = 1;

    try {
      const creator = new PteroCreate(domain, apikeyptero);
      const username = nameserver.toLowerCase().replace(/[^a-zA-Z0-9]/g, '') + Math.floor(Math.random() * 1000);
      const email = `${username}@mail.com`;
      const password = generatePassword();

      const eggData = await creator.getEggStartup(nestid, eggid);
      const startup = eggData.startup;
      const environment = {};

      if (Array.isArray(eggData.variables)) {
        eggData.variables.forEach(v => {
          environment[v.env_variable] = v.env_variable === "CMD_RUN"
            ? "npm start"
            : (v.default_value || "");
        });
      }

      if (!environment["CMD_RUN"]) {
        environment["CMD_RUN"] = "npm start";
      }

      const user = await creator.createUser(email, username, password);

      const serverPayload = {
        name: nameserver,
        user: user.id,
        egg: eggid,
        docker_image: "ghcr.io/parkervcp/yolks:nodejs_18",
        startup,
        environment,
        limits: {
          memory: parsedDisk,
          swap: 0,
          disk: parsedDisk,
          io: 500,
          cpu
        },
        feature_limits: {
          databases: 1,
          allocations: 1,
          backups: 1
        },
        deploy: {
          locations: [locid],
          dedicated_ip: false,
          port_range: []
        },
        start_on_completion: true
      };

      const server = await creator.createServer(serverPayload);

      return res.json({
        status: true,
        creator: 'Vanzz Ryuichi',
        data: {
          id_user: user.id,
          id_server: server.id,
          nama_server: nameserver,
          domain_panel: domain,
          username: user.username,
          password,
          ram: parsedDisk,
          cpu: cpu // tampilkan cpu yang digunakan
        }
      });

    } catch (err) {
      return res.status(500).json({
        status: false,
        creator: 'Vanzz Ryuichi',
        error: err.response?.data || err.message
      });
    }
  });
};
