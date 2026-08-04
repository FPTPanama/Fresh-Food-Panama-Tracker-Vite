import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export const handler = async () => {
  console.log("🚀 Iniciando inyección masiva del censo de Mercamadrid...");

  const mercamadridLeads = [
    { company_name: "FRUTAS Y VERDURAS J&R BARGUEÑO, S.L.", contact_phone: "917858701", contact_email: "comercial@bargue.es", website: null },
    { company_name: "LORENZO IZQUIERDO, S.L.", contact_phone: "917852802", contact_email: "lisl@telefonica.net", website: null },
    { company_name: "FRUITS CMR S.A.", contact_phone: "92 524 50 00", contact_email: "madrid@cmrfruits.com", website: "www.cmrgroup.es" },
    { company_name: "FRUTAS PLASENCIA, S.L.", contact_phone: "917855402", contact_email: "madrid@frutasplasencia.com", website: "www.frutasplasencia.com" },
    { company_name: "MANGUAN, S.L.", contact_phone: "917853514", contact_email: "eugenia@manguanehijos.com", website: "www.manguanehijos.com" },
    { company_name: "CIA FRU&VER MADRID, S.L.", contact_phone: "917856512", contact_email: "info@fruiver.com", website: null },
    { company_name: "FRUTAS A.Z. S.L.", contact_phone: "91 786 78 40", contact_email: "contabilidad@frutas-az.es", website: "frutas-az.es" },
    { company_name: "ANGEL JODRA, S.L.", contact_phone: "917853296", contact_email: "administracion@angeljodra.es", website: null },
    { company_name: "PATATAS HERMANOS ÁLVAREZ, S.L.", contact_phone: "91 665 76 41", contact_email: "javier@patatashnosalvarez.com", website: "www.patatashnosalvarez.com" },
    { company_name: "DISTRIBUCION HORTICOLA S.L.", contact_phone: "91 692 80 00", contact_email: "facturacion@dhoy.es", website: null },
    { company_name: "HERMANOS SALAS, S.A.", contact_phone: "917850011", contact_email: "celia@hsalas.es", website: null },
    { company_name: "VERDEFRUT MARKETING, S.L.", contact_phone: "916928000", contact_email: "pedro@dhoy.es", website: null },
    { company_name: "HORTÍCOLAS GALEGAS, S.L.", contact_phone: "988 46 24 51", contact_email: "admon@horticolasgalegas.es", website: null },
    { company_name: "ECOSUPER ALIMENTACION, S.L.", contact_phone: "91 692 45 36", contact_email: "m.molpeceres@ecoali.com", website: null },
    { company_name: "DEMARY FRUTAS Y VERDURAS, S.L.", contact_phone: "914649190", contact_email: "demaryfrutasyverdurassl@hotmail.com", website: null },
    { company_name: "HOSTELERÍA PÉREZ BAEZA, S.L.", contact_phone: "91 785 17 12", contact_email: "jjperezbaeza@gmail.com", website: null },
    { company_name: "FRUTAS HERMANOS BERENGUER, S.L.", contact_phone: "915071723", contact_email: "rafaberenguerfr@gmail.com", website: null },
    { company_name: "FRUTAS Y VERDURAS MOSTOLES, S.L.U.", contact_phone: "917857301", contact_email: "evagl31@hotmail.com", website: null },
    { company_name: "PALACIOS ROCA, S.A.U.", contact_phone: "917856196", contact_email: "foodservice@palaciosroca.com", website: "www.palaciosroca.com" },
    { company_name: "HIJOS DE SINFOROSO RAMIREZ ABADIA, S.L.", contact_phone: "917857000", contact_email: "hsramirez@hotmail.com", website: "www.sinforosoramirez.com" },
    { company_name: "FRUTAS BOUHABEN, S.L.", contact_phone: "917854695", contact_email: "ismael@frutasbouhaben.com", website: null },
    { company_name: "MORENO HUERTA, S.A.", contact_phone: "91 785 73 00", contact_email: "danielmoreno@morenohuerta.es", website: "www.morenohuerta.es" },
    { company_name: "HERMANOS BONILLA ROLLÁN, S.L.", contact_phone: "91 785 96 46", contact_email: "info@hermanosbonilla.com", website: "www.hermanosbonilla.com" },
    { company_name: "GREEN SELECT, S.L.", contact_phone: "917856600", contact_email: "administracion@greenselect.es", website: null },
    { company_name: "FRUTAS SANTI, S.L.", contact_phone: "917853667", contact_email: "fsantisl@telefonica.net", website: null },
    { company_name: "CARLOS GOMEZ, S.L.", contact_phone: "917856300", contact_email: "centrimerca@centrimerca.es", website: null },
    { company_name: "NUFRI, S.L. UNIPERSONAL", contact_phone: "91 507 91 58", contact_email: "mad.almacen@nufri.com", website: "www.nufri.com" },
    { company_name: "RAFAEL ASENJO, S.L.", contact_phone: "917856200", contact_email: null, website: null },
    { company_name: "FRUTAS E. SANCHEZ, S.L.", contact_phone: "917866576", contact_email: "frutas@frutasesanchez.com", website: "www.frutasesanchez.com" },
    { company_name: "IBÉRICA DE PATATAS SELECTAS, S.L.", contact_phone: "91 785 43 12", contact_email: null, website: null },
    { company_name: "GOMEZ MARTINEZ, JUAN CARLOS YOSCAR-MAR", contact_phone: "917856202", contact_email: null, website: null },
    { company_name: "JOSE MARIA NADADOR E HIJO, S.L.", contact_phone: "917856294", contact_email: "jmnadador@gmail.com", website: null },
    { company_name: "FRUTAS HEREDIA, S.L.", contact_phone: "91 785 18 02", contact_email: "info@frutasheredia.com", website: null },
    { company_name: "HERMANOS FERNANDEZ LOPEZ, S.A.U.", contact_phone: "91 785 99 29", contact_email: "info@grupofernandez.es", website: "www.grupofernandez.es" },
    { company_name: "COMERCIAL PATALETA, S.A.", contact_phone: "917854801", contact_email: "juanito@pataleta.com", website: null },
    { company_name: "MADREMIA, S.L.", contact_phone: "915074432", contact_email: "madremia@madremia.es", website: "www.madremia.es" },
    { company_name: "CRUZ MUÑOZ, S.L.", contact_phone: "917852598", contact_email: "jmunozcruz@telefonica.net", website: null },
    { company_name: "VERYFRUT ENCANTADA, S.L.", contact_phone: "699589862", contact_email: "lafrutadeverdad@gmail.com", website: null },
    { company_name: "E.J.GALVEZ, S.L.", contact_phone: "917857395", contact_email: "ejgalvezsl@gmail.com", website: null },
    { company_name: "FRUTAS FIDALGO, S.L.", contact_phone: "917854901", contact_email: "frutasfidalgo@frutasfidalgo.com", website: "www.frutasfidalgo.com" },
    { company_name: "KIWI-WORLD, S.A.", contact_phone: "91 786 65 76", contact_email: "kiwiworld@gmail.com", website: null },
    { company_name: "IBERFRUPA, S.L.", contact_phone: "917850395", contact_email: null, website: null },
    { company_name: "GUERRERO FRESH COMPANY, S.L.", contact_phone: "916859447", contact_email: "mariano@guerrero-fc.com", website: null },
    { company_name: "CENTRIMERCA, S.A.", contact_phone: "917854902", contact_email: "centrimerca@centrimerca.es", website: null },
    { company_name: "JERONIMO BARRIO, S.L.", contact_phone: "917854994", contact_email: "j.luisbarrio@yahoo.es", website: null },
    { company_name: "PEYRO FRUIT, S.L.", contact_phone: "917851702", contact_email: "peyrofruit@gmail.com", website: null },
    { company_name: "CENTRAL DICA, S.A.U.", contact_phone: "917866425", contact_email: "grupolc@grupolc.com", website: "grupolc.com" },
    { company_name: "SALTO A ORIGEN, S.L.", contact_phone: "682351911", contact_email: "m.valencia@mercajara.eu", website: null },
    { company_name: "RIAZA AZAIR, S.L.", contact_phone: "915077265", contact_email: "juan.riaza@riaza-azair.com", website: "www.riaza-azair.com" },
    { company_name: "CHAMPIÑONES CUMAR, S.L.U.", contact_phone: "967486152", contact_email: "info@cumar.es", website: "www.cumar.es" },
    { company_name: "FRUTAS CANDIL, S.L.", contact_phone: "917855416", contact_email: "frutascandil@frutascandil.com", website: "www.frutascandil.com" },
    { company_name: "FRUTAS MOLINOS, S.A.", contact_phone: "917851602", contact_email: "fmolinos@hotmail.es", website: null },
    { company_name: "FRUTAS Y VERDURAS J.C. AGUADO, S.L.", contact_phone: "91 785 49 96", contact_email: "grupoaguado2012@gmail.com", website: null },
    { company_name: "FRUTAS MAYDE, S.L.", contact_phone: "609082003", contact_email: "laura@frutasmayde.es", website: null },
    { company_name: "FRUTAS ZARAMADRID, S.L.", contact_phone: "917855096", contact_email: "pegamu@wanadoo.es", website: null },
    { company_name: "ABC QLT NATURE, S.L.", contact_phone: "910692998", contact_email: null, website: null },
    { company_name: "FRUTAS ANTONIO GOMEZ, S.L.", contact_phone: "917857196", contact_email: null, website: null },
    { company_name: "OTERFRUT, S.L.", contact_phone: "917858700", contact_email: "oterfrut@oterfrut.com", website: null },
    { company_name: "MAYORISTAS DE CITRICOS EN MADRID, S.L.", contact_phone: "917857294", contact_email: "macima@fontestad.com", website: "www.fontestad.com" },
    { company_name: "HORTOFRUTICOLA BERMEJO HERMANOS, S.L.", contact_phone: "917857201", contact_email: null, website: null },
    { company_name: "FURGO FRUTA, S.L.", contact_phone: "917866562", contact_email: "furgofruta@gmail.com", website: null },
    { company_name: "FRUTAS NIQUI MADRIMPORT, S.L.", contact_phone: "915073300", contact_email: "aalmazan@niqui.es", website: null },
    { company_name: "FRUTAS Y HORTALIZAS CENTURION, S.L.", contact_phone: "915070497", contact_email: "tonicenturion@gmail.com", website: null },
    { company_name: "FRIT RAVICH, S.L.", contact_phone: "972 85 80 08", contact_email: "dlcontabilidadacreedores@fritravich.com", website: null },
    { company_name: "FRUTAS PERICHAN, S.L.", contact_phone: "91 507 70 10", contact_email: "frutasperichan@perichan.com", website: "www.perichan.com" },
    { company_name: "FRUTAS ASTURIAS, S.A.", contact_phone: "917851896", contact_email: "infoasturias@frutasasturias.com", website: null },
    { company_name: "FRUTAS MANUEL VAZQUEZ BARCIA,  S.A.", contact_phone: "91 785 65 02", contact_email: null, website: null },
    { company_name: "FRUTAS HERMANOS MONTES, S.A.", contact_phone: "917850101", contact_email: "montes@hermanosmontes.com", website: "www.hermanosmontes.com" },
    { company_name: "REDONDO FRUTAS Y HORTALIZAS, S.L.", contact_phone: "917857495", contact_email: "redondo@redondofrutas.com", website: "www.redondofrutas.com" },
    { company_name: "FRUTAS JAVIER MARTIN, S.L.", contact_phone: "917855295", contact_email: "prior@frutasjmartinsl.net", website: null },
    { company_name: "COMERCIO DE PATATAS Y CEBOLLAS, S.L.U.", contact_phone: "91 785 17 95", contact_email: "administracion@comerciodepatatasycebollas.es", website: null },
    { company_name: "EUROBANAN GAMERO, S.L.", contact_phone: "91 779 66 89", contact_email: null, website: null },
    { company_name: "FRUTAS ALBA, S.L.", contact_phone: "917858702", contact_email: "al-ba@frutasal-ba.com", website: "http://www.frutasal-ba.com/" },
    { company_name: "PLA FAUS, S.L.", contact_phone: "917857700", contact_email: "plafaus@plafaus.es", website: "http://www.plafaus.es/" },
    { company_name: "FRUTINTER, S.L.", contact_phone: "915073152", contact_email: "gerencia@frutinter.com", website: "www.frutinter.com" },
    { company_name: "COMERCIAL HORTOFRUTICOLA HNOS.IRIARTE, S.L.", contact_phone: "915076745", contact_email: "jose@iri.e.telefonica.net", website: null },
    { company_name: "VERDURAS MARCAFRUIT, S.L.", contact_phone: "91 507 01 82", contact_email: "marcafruit@marcafruit.com", website: "www.marcafruit.es" },
    { company_name: "FRUTAS GONZALEZ GARZON, S.L.", contact_phone: "917855200", contact_email: "info@frutasgonzalezg.es", website: "www.frutasgonzalezg.es" },
    { company_name: "SERRANO GAGO, S.L.", contact_phone: "911 374 490", contact_email: "serranogago@hotmail.com", website: null },
    { company_name: "DON FRUTA, S.L.", contact_phone: "622584247", contact_email: "jorge@donfruta.eu", website: "www.donfruta.com" },
    { company_name: "FRUTAS BARRANTES, S.L.", contact_phone: "91 785 75 02", contact_email: "frutasbarrantes@telefonica.net", website: null },
    { company_name: "ALJOFER, S.A.", contact_phone: "914 216 056", contact_email: "administracion@aljofermadrid.com", website: "https://www.aljofer.com/" },
    { company_name: "MISSIWA FRUIT, S.L.", contact_phone: "654 572 601", contact_email: "missiwa2015@gmail.com", website: null },
    { company_name: "FRUTAS ALOMAR, S.A.", contact_phone: "91 785 77 94", contact_email: "contabilidad@frutasalomar.com", website: "www.frutasalomar.com" },
    { company_name: "VICTOR LAZARO, S.A.", contact_phone: "917850394", contact_email: "victorlazarosa@yahoo.es", website: "www.victorlazarosa.es" },
    { company_name: "RONAD FRUT, S.A.", contact_phone: "917858795", contact_email: "jmnadador@gmail.com", website: null },
    { company_name: "MELENDEZ MARKET, S.L.", contact_phone: "646260347", contact_email: "antonio.gutierrez@melendezmarket.com", website: null },
    { company_name: "CASA NOYA, S.L.", contact_phone: "917860790", contact_email: "info@casanoya.es", website: "www.casanoya.es" },
    { company_name: "FRUTAS MARPA, S.L.", contact_phone: "917850302", contact_email: "frutasmarpasl@hotmail.com", website: null },
    { company_name: "AGRONATURAL 9920, S.L.", contact_phone: "917866294", contact_email: null, website: null },
    { company_name: "LA MEJOR FRUTA DE VALLECAS, S.L.", contact_phone: "659422321", contact_email: "dulaldali1975@gmail.com", website: null },
    { company_name: "MARTIN VILLAVERDE DISTRIBUCION ALIMENTARIA, S.L.", contact_phone: "91 786 26 60", contact_email: "comercial@mvillaverde.com", website: "www.mvillaverde.com" },
    { company_name: "FRUTARIA MARKETS MADRID, S.A.", contact_phone: "917857513", contact_email: "ajuarez@frutaria.com", website: "www.frutexport.com" },
    { company_name: "FELIX CATALÁN, S.L.", contact_phone: "916824361", contact_email: "felixcatalanpatatas@gmail.com", website: null },
    { company_name: "FRUTAS CARDEÑA, S.L.", contact_phone: "605 92 29 67", contact_email: "xuxana1974@hotmail.es", website: null },
    { company_name: "GRUPO LLUSAR TORRES, S.A.U.", contact_phone: "628073588", contact_email: "mercamadrid@naranjastorres.com", website: "www.naranjastorres.com" },
    { company_name: "TROBO DE ROA, S.L.", contact_phone: "917857894", contact_email: "frutastrobo@frutastrobo.com", website: "www.frutastrobo.com" },
    { company_name: "VIGARRI, S.L.", contact_phone: "917855794", contact_email: "info@garrigos.es", website: null },
    { company_name: "FRUSANGAR, S.L.", contact_phone: "91 608 28 19", contact_email: "info@frusangar.com", website: "www.frusangar.com" },
    { company_name: "GUILLEN MERCA, S.L.", contact_phone: "917857994", contact_email: "guillenmerca@guillenmerca.es", website: null },
    { company_name: "FRUTAS AVALON, S.L.U.", contact_phone: "684 087 106", contact_email: "deborah@frutasavalon.com", website: "www.frutasavalon.com" },
    { company_name: "FRUTAS TELLEZ, S.A.", contact_phone: "91 785 58 02", contact_email: "frutastellez@frutastellez.com", website: null },
    { company_name: "LAUMONT S.L.U.", contact_phone: "917858002", contact_email: "madrid@laumont.net", website: "www.laumont.net" },
    { company_name: "FRUTAS HERMANOS RUIZ GOMEZ, S.L", contact_phone: "917863413", contact_email: "frutashrg@frutashrg.com", website: "www.frutashrg.com" },
    { company_name: "FRUTAS PINTO PIRIS, S.L.", contact_phone: "917860797", contact_email: "frutaspintopiris@gmail.com", website: null },
    { company_name: "DON MELON, S.L.", contact_phone: "917858100", contact_email: "donmelonmerca@hotmail.com", website: null },
    { company_name: "FRUTAS KIKITO MADRID, S.L.", contact_phone: "91 507 63 45", contact_email: "ignacioredondo@kikito.com", website: "www.kikito.com" },
    { company_name: "NAIMA MADANI", contact_phone: "600802696", contact_email: "nmadani@helmylimited.com", website: "www.helmylimited.com" }
  ];

  // Aplicamos el formato final requerido por tu base de datos
  const formattedLeads = mercamadridLeads.map(lead => ({
    ...lead,
    city: "Madrid",
    country: "España",
    country_code: "ES",
    ai_analysis: "Mayorista oficial consolidado en instalaciones de Mercamadrid. Perfil corporativo excelente para importación de volumen.",
    lead_score: 9.0, // Alta prioridad garantizada
    status: 'new',   // Listo para los vendedores
    source: 'mercamadrid-direct', // Etiqueta especial
    interested_in: ["Piña Premium"],
    pipeline_stage: 'inbox',
    created_at: new Date().toISOString()
  }));

  try {
    const { error } = await supabase.from('leads_prospecting').upsert(formattedLeads, {
      onConflict: 'company_name,city',
      ignoreDuplicates: true
    });

    if (error) throw error;
    
    console.log(`✅ ¡BOOM! ${formattedLeads.length} Titanes de Mercamadrid inyectados en tu CRM.`);
    return { statusCode: 200 };
  } catch (err: any) {
    console.error("❌ Error en la inyección masiva:", err.message);
    return { statusCode: 500 };
  }
};