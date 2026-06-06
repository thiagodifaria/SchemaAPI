use actix_web::{get, post, web, HttpResponse, Responder};
use serde::Deserialize;
use serde_json::json;
use std::collections::HashSet;
use uuid::Uuid;

use crate::infrastructure::persistence::postgres::PostgresRepository;

#[derive(Deserialize)]
pub struct AnalysisReportRequest {
    pub title: Option<String>,
    pub scope_label: Option<String>,
    pub document_ids: Option<Vec<Uuid>>,
    pub search_queries: Option<Vec<String>>,
    pub rag_queries: Option<Vec<String>>,
    pub executive_summary: Option<String>,
    pub evidence: Option<Vec<String>>,
    pub metrics: Option<Vec<String>>,
    pub risks: Option<Vec<String>>,
    pub sources: Option<Vec<String>>,
    pub notes: Option<String>,
    pub markdown: Option<String>,
}

#[derive(Deserialize)]
struct ListQuery {
    limit: Option<i64>,
}

#[derive(Deserialize)]
struct ExportQuery {
    format: Option<String>,
}

#[post("/analysis/reports")]
pub async fn create_analysis_report(
    repo: web::Data<PostgresRepository>,
    payload: web::Json<AnalysisReportRequest>,
) -> impl Responder {
    let title = clean_value(payload.title.as_deref())
        .unwrap_or_else(|| "Analise executiva - Schema API".to_string());
    let scope_label = clean_value(payload.scope_label.as_deref());
    let document_ids = payload.document_ids.clone().unwrap_or_default();
    let search_queries = clean_list(payload.search_queries.as_deref().unwrap_or(&[]));
    let rag_queries = clean_list(payload.rag_queries.as_deref().unwrap_or(&[]));
    let evidence = clean_list(payload.evidence.as_deref().unwrap_or(&[]));
    let metrics = clean_list(payload.metrics.as_deref().unwrap_or(&[]));
    let risks = clean_list(payload.risks.as_deref().unwrap_or(&[]));
    let sources = clean_list(payload.sources.as_deref().unwrap_or(&[]));

    let executive_summary = clean_value(payload.executive_summary.as_deref())
        .or_else(|| evidence.first().cloned())
        .unwrap_or_else(|| {
            "Analise gerada sem evidencias suficientes. Execute buscas e perguntas RAG antes de exportar."
                .to_string()
        });

    let mut markdown = clean_value(payload.markdown.as_deref())
        .unwrap_or_else(|| build_markdown(&title, &executive_summary, &evidence, &metrics, &risks, &sources, &search_queries, &rag_queries));

    if let Some(notes) = clean_value(payload.notes.as_deref()) {
        markdown.push_str("\n\n## Observacoes do analista\n");
        markdown.push_str(&notes);
    }

    match repo
        .create_analysis_report(
            &title,
            scope_label.as_deref(),
            &document_ids,
            &search_queries,
            &rag_queries,
            &executive_summary,
            json!(evidence),
            json!(metrics),
            json!(risks),
            json!(sources),
            &markdown,
        )
        .await
    {
        Ok(report) => {
            let _ = repo
                .record_audit_event(
                    "analysis.report",
                    Some("analyst"),
                    Some("analysis_report"),
                    Some(report.id),
                    json!({
                        "title": report.title.clone(),
                        "scope": report.scope_label.clone(),
                        "documents": report.document_ids.len(),
                        "search_queries": report.search_queries.len(),
                        "rag_queries": report.rag_queries.len(),
                    }),
                )
                .await;
            HttpResponse::Ok().json(report)
        }
        Err(error) => HttpResponse::InternalServerError().json(json!({
            "error": "analysis_report_create_failed",
            "message": error.to_string(),
        })),
    }
}

#[get("/analysis/reports")]
pub async fn list_analysis_reports(
    repo: web::Data<PostgresRepository>,
    query: web::Query<ListQuery>,
) -> impl Responder {
    let limit = query.limit.unwrap_or(25).clamp(1, 100);
    match repo.list_analysis_reports(limit).await {
        Ok(reports) => HttpResponse::Ok().json(reports),
        Err(error) => HttpResponse::InternalServerError().json(json!({
            "error": "analysis_report_list_failed",
            "message": error.to_string(),
        })),
    }
}

#[get("/analysis/reports/{id}")]
pub async fn get_analysis_report(
    repo: web::Data<PostgresRepository>,
    path: web::Path<Uuid>,
) -> impl Responder {
    match repo.find_analysis_report(path.into_inner()).await {
        Ok(Some(report)) => HttpResponse::Ok().json(report),
        Ok(None) => HttpResponse::NotFound().json(json!({ "error": "analysis_report_not_found" })),
        Err(error) => HttpResponse::InternalServerError().json(json!({
            "error": "analysis_report_get_failed",
            "message": error.to_string(),
        })),
    }
}

#[get("/analysis/reports/{id}/export")]
pub async fn export_analysis_report(
    repo: web::Data<PostgresRepository>,
    path: web::Path<Uuid>,
    query: web::Query<ExportQuery>,
) -> impl Responder {
    let report = match repo.find_analysis_report(path.into_inner()).await {
        Ok(Some(report)) => report,
        Ok(None) => return HttpResponse::NotFound().json(json!({ "error": "analysis_report_not_found" })),
        Err(error) => {
            return HttpResponse::InternalServerError().json(json!({
                "error": "analysis_report_export_failed",
                "message": error.to_string(),
            }));
        }
    };

    match query.format.as_deref().unwrap_or("md").to_lowercase().as_str() {
        "doc" | "html" => HttpResponse::Ok()
            .content_type("application/msword; charset=utf-8")
            .body(report_document_html(&report.title, &report.markdown)),
        "pdf" => HttpResponse::Ok()
            .content_type("application/pdf")
            .body(build_pdf(&report.title, &report.markdown)),
        _ => HttpResponse::Ok()
            .content_type("text/markdown; charset=utf-8")
            .body(report.markdown),
    }
}

fn clean_value(value: Option<&str>) -> Option<String> {
    value
        .map(|item| item.replace("\\n", "\n").trim().to_string())
        .filter(|item| !item.is_empty())
}

fn clean_list(values: &[String]) -> Vec<String> {
    let mut result = Vec::new();
    let mut seen = HashSet::new();
    for value in values {
        if let Some(cleaned) = clean_value(Some(value)) {
            let key = dedupe_key(&cleaned);
            if seen.insert(key) {
                result.push(cleaned);
            }
        }
    }
    result
}

fn dedupe_key(value: &str) -> String {
    value
        .to_lowercase()
        .chars()
        .filter(|character| character.is_alphanumeric() || character.is_whitespace())
        .collect::<String>()
        .split_whitespace()
        .take(28)
        .collect::<Vec<&str>>()
        .join(" ")
}

fn build_markdown(
    title: &str,
    executive_summary: &str,
    evidence: &[String],
    metrics: &[String],
    risks: &[String],
    sources: &[String],
    search_queries: &[String],
    rag_queries: &[String],
) -> String {
    let mut seen = HashSet::new();
    let mut lines = vec![
        format!("# {title}"),
        String::new(),
        "## Resposta executiva".to_string(),
        executive_summary.to_string(),
        String::new(),
        "## Principais evidencias".to_string(),
    ];
    append_unique_items(&mut lines, evidence, "Nenhuma evidencia consolidada.", &mut seen);
    lines.push(String::new());
    lines.push("## Metricas e variacoes".to_string());
    append_unique_items(&mut lines, metrics, "Nenhuma metrica consolidada.", &mut seen);
    lines.push(String::new());
    lines.push("## Pontos de atencao".to_string());
    append_unique_items(&mut lines, risks, "Nenhum risco destacado automaticamente.", &mut seen);
    lines.push(String::new());
    lines.push("## Perguntas RAG consideradas".to_string());
    append_items(&mut lines, rag_queries, "Nenhuma pergunta RAG considerada.");
    lines.push(String::new());
    lines.push("## Buscas consideradas".to_string());
    append_items(&mut lines, search_queries, "Nenhuma busca hibrida considerada.");
    lines.push(String::new());
    lines.push("## Fontes".to_string());
    append_items(&mut lines, sources, "Fontes ainda nao consolidadas.");
    lines.join("\n")
}

fn append_items(lines: &mut Vec<String>, items: &[String], empty: &str) {
    if items.is_empty() {
        lines.push(format!("- {empty}"));
    } else {
        for item in items {
            lines.push(format!("- {item}"));
        }
    }
}

fn append_unique_items(
    lines: &mut Vec<String>,
    items: &[String],
    empty: &str,
    seen: &mut HashSet<String>,
) {
    let mut added = false;
    for item in items {
        if seen.insert(dedupe_key(item)) {
            lines.push(format!("- {item}"));
            added = true;
        }
    }
    if !added {
        lines.push(format!("- {empty}"));
    }
}

fn report_document_html(title: &str, markdown: &str) -> String {
    format!(
        r#"<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>{}</title>
  <style>
    @page {{ margin: 28mm 22mm; }}
    body {{ font-family: Arial, sans-serif; color: #17202a; line-height: 1.58; margin: 36px; }}
    .cover {{ border: 1px solid #99f6e4; background: #f0fdfa; padding: 22px; margin-bottom: 22px; }}
    .eyebrow {{ color: #0f766e; font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }}
    h1 {{ font-size: 26px; margin: 8px 0 4px; }}
    h2 {{ color: #111827; font-size: 16px; margin-top: 24px; border-bottom: 1px solid #dfe5ea; padding-bottom: 7px; }}
    p {{ margin: 7px 0; }}
    ul {{ margin: 8px 0 0 18px; padding: 0; }}
    li {{ margin: 6px 0; }}
    .footer {{ color: #64748b; font-size: 11px; margin-top: 30px; border-top: 1px solid #dfe5ea; padding-top: 10px; }}
  </style>
</head>
<body>
  <section class="cover">
    <div class="eyebrow">Schema API - relatorio executivo</div>
    <h1>{}</h1>
    <p>Gerado em {} a partir das buscas, perguntas RAG e evidencias recuperadas nesta sessao.</p>
  </section>
  {}
  <div class="footer">Relatorio gerado automaticamente. Revise os trechos citados antes de uso externo.</div>
</body>
</html>"#,
        escape_html(title),
        escape_html(title),
        chrono::Utc::now().format("%d/%m/%Y %H:%M UTC"),
        markdown_to_html(markdown)
    )
}

fn markdown_to_html(markdown: &str) -> String {
    let mut html = Vec::new();
    let mut in_list = false;
    for line in markdown.lines() {
        if let Some(text) = line.strip_prefix("- ") {
            if !in_list {
                html.push("<ul>".to_string());
                in_list = true;
            }
            html.push(format!("<li>{}</li>", escape_html(text)));
            continue;
        }

        if in_list {
            html.push("</ul>".to_string());
            in_list = false;
        }

        html.push(
            if let Some(text) = line.strip_prefix("# ") {
                format!("<h1>{}</h1>", escape_html(text))
            } else if let Some(text) = line.strip_prefix("## ") {
                format!("<h2>{}</h2>", escape_html(text))
            } else if line.trim().is_empty() {
                "<br />".to_string()
            } else {
                format!("<p>{}</p>", escape_html(line))
            }
        );
    }
    if in_list {
        html.push("</ul>".to_string());
    }
    html.join("\n")
}

fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#039;")
}

fn build_pdf(title: &str, markdown: &str) -> Vec<u8> {
    #[derive(Clone)]
    enum PdfLineKind {
        Title,
        Meta,
        Heading,
        Bullet,
        Body,
        Space,
    }

    #[derive(Clone)]
    struct PdfLine {
        kind: PdfLineKind,
        text: String,
    }

    let mut lines = vec![
        PdfLine {
            kind: PdfLineKind::Title,
            text: pdf_clean_text(title),
        },
        PdfLine {
            kind: PdfLineKind::Meta,
            text: format!(
                "Relatorio executivo gerado em {} pela Schema API.",
                chrono::Utc::now().format("%d/%m/%Y %H:%M UTC")
            ),
        },
        PdfLine {
            kind: PdfLineKind::Space,
            text: String::new(),
        },
    ];

    let mut seen_bullets = HashSet::new();
    let mut current_section = String::from("inicio");
    for raw in markdown.lines() {
        let trimmed = raw.trim();
        if trimmed.is_empty() || trimmed.starts_with("# ") {
            continue;
        }
        if let Some(text) = trimmed.strip_prefix("## ") {
            current_section = pdf_clean_text(text);
            seen_bullets.clear();
            lines.push(PdfLine {
                kind: PdfLineKind::Space,
                text: String::new(),
            });
            lines.push(PdfLine {
                kind: PdfLineKind::Heading,
                text: pdf_clean_text(text),
            });
            continue;
        }
        if let Some(text) = trimmed.strip_prefix("- ") {
            let cleaned = pdf_clean_text(text);
            let section_key = format!("{}::{}", current_section, dedupe_key(&cleaned));
            if seen_bullets.insert(section_key) {
                for (index, wrapped) in wrap_line(&cleaned, 88).into_iter().enumerate() {
                    let text = if index == 0 {
                        format!("- {wrapped}")
                    } else {
                        format!("  {wrapped}")
                    };
                    lines.push(PdfLine {
                        kind: PdfLineKind::Bullet,
                        text,
                    });
                }
            }
            continue;
        }
        for wrapped in wrap_line(&pdf_clean_text(trimmed), 92) {
            lines.push(PdfLine {
                kind: PdfLineKind::Body,
                text: wrapped,
            });
        }
    }

    let page_lines = 44usize;
    let pages = lines.chunks(page_lines).collect::<Vec<&[PdfLine]>>();
    let page_count = pages.len().max(1);
    let mut objects: Vec<String> = vec![String::new(); 3 + page_count * 2 + 1];
    objects[1] = "<< /Type /Catalog /Pages 2 0 R >>".to_string();
    let kids = (0..page_count)
        .map(|index| format!("{} 0 R", 4 + index * 2))
        .collect::<Vec<String>>()
        .join(" ");
    objects[2] = format!("<< /Type /Pages /Kids [{kids}] /Count {page_count} >>");
    objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>".to_string();

    for (index, page) in pages.iter().enumerate() {
        let page_id = 4 + index * 2;
        let content_id = page_id + 1;
        objects[page_id] = format!(
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents {content_id} 0 R >>"
        );
        let mut stream = String::from("BT\n50 792 Td\n");
        let mut current_size = 11;
        stream.push_str("/F1 11 Tf\n15 TL\n");
        for line in *page {
            let (size, leading, move_after) = match line.kind {
                PdfLineKind::Title => (18, 24, 1),
                PdfLineKind::Meta => (9, 15, 1),
                PdfLineKind::Heading => (13, 20, 1),
                PdfLineKind::Bullet => (10, 15, 1),
                PdfLineKind::Body => (10, 15, 1),
                PdfLineKind::Space => (10, 10, 1),
            };
            if size != current_size {
                stream.push_str(&format!("/F1 {size} Tf\n"));
                current_size = size;
            }
            stream.push_str(&format!("{leading} TL\n"));
            if !line.text.is_empty() {
                stream.push('(');
                stream.push_str(&escape_pdf_text(&line.text));
                stream.push_str(") Tj\n");
            }
            for _ in 0..move_after {
                stream.push_str("T*\n");
            }
        }
        stream.push_str("ET\n");
        stream.push_str("BT\n50 34 Td\n/F1 8 Tf\n");
        stream.push_str(&format!(
            "(Schema API - pagina {} de {} - revise as fontes antes de uso externo.) Tj\n",
            index + 1,
            page_count
        ));
        stream.push_str("ET\n");
        objects[content_id] = format!("<< /Length {} >>\nstream\n{}endstream", stream.len(), stream);
    }

    let mut output = String::from("%PDF-1.4\n");
    let mut offsets = vec![0usize; objects.len()];
    for id in 1..objects.len() {
        offsets[id] = output.len();
        output.push_str(&format!("{id} 0 obj\n{}\nendobj\n", objects[id]));
    }
    let xref = output.len();
    output.push_str(&format!("xref\n0 {}\n0000000000 65535 f \n", objects.len()));
    for offset in offsets.iter().skip(1) {
        output.push_str(&format!("{offset:010} 00000 n \n"));
    }
    output.push_str(&format!(
        "trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF",
        objects.len()
    ));
    output.into_bytes()
}

fn wrap_line(value: &str, width: usize) -> Vec<String> {
    if value.is_empty() {
        return vec![String::new()];
    }
    let mut lines = Vec::new();
    let mut current = String::new();
    for word in value.split_whitespace() {
        if current.len() + word.len() + 1 > width && !current.is_empty() {
            lines.push(current);
            current = String::new();
        }
        if !current.is_empty() {
            current.push(' ');
        }
        current.push_str(word);
    }
    if !current.is_empty() {
        lines.push(current);
    }
    lines
}

#[allow(dead_code)]
fn pdf_safe(value: &str) -> String {
    value
        .replace('á', "a")
        .replace('à', "a")
        .replace('ã', "a")
        .replace('â', "a")
        .replace('é', "e")
        .replace('ê', "e")
        .replace('í', "i")
        .replace('ó', "o")
        .replace('ô', "o")
        .replace('õ', "o")
        .replace('ú', "u")
        .replace('ç', "c")
        .replace('Á', "A")
        .replace('À', "A")
        .replace('Ã', "A")
        .replace('Â', "A")
        .replace('É', "E")
        .replace('Ê', "E")
        .replace('Í', "I")
        .replace('Ó', "O")
        .replace('Ô', "O")
        .replace('Õ', "O")
        .replace('Ú', "U")
        .replace('Ç', "C")
}

fn pdf_clean_text(value: &str) -> String {
    value
        .chars()
        .map(|character| match character {
            '\u{00e1}' | '\u{00e0}' | '\u{00e3}' | '\u{00e2}' | '\u{00e4}'
            | '\u{00c1}' | '\u{00c0}' | '\u{00c3}' | '\u{00c2}' | '\u{00c4}' => 'a',
            '\u{00e9}' | '\u{00e8}' | '\u{00ea}' | '\u{00eb}' | '\u{00c9}'
            | '\u{00c8}' | '\u{00ca}' | '\u{00cb}' => 'e',
            '\u{00ed}' | '\u{00ec}' | '\u{00ee}' | '\u{00ef}' | '\u{00cd}'
            | '\u{00cc}' | '\u{00ce}' | '\u{00cf}' => 'i',
            '\u{00f3}' | '\u{00f2}' | '\u{00f5}' | '\u{00f4}' | '\u{00f6}'
            | '\u{00d3}' | '\u{00d2}' | '\u{00d5}' | '\u{00d4}' | '\u{00d6}' => 'o',
            '\u{00fa}' | '\u{00f9}' | '\u{00fb}' | '\u{00fc}' | '\u{00da}'
            | '\u{00d9}' | '\u{00db}' | '\u{00dc}' => 'u',
            '\u{00e7}' | '\u{00c7}' => 'c',
            '\u{00f1}' | '\u{00d1}' => 'n',
            '\u{2013}' | '\u{2014}' | '\u{2022}' | '\u{221a}' => '-',
            '\u{201c}' | '\u{201d}' => '"',
            '\u{2018}' | '\u{2019}' => '\'',
            '\n' | '\r' | '\t' => ' ',
            ascii if ascii.is_ascii() => ascii,
            _ => ' ',
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<&str>>()
        .join(" ")
}

#[allow(dead_code)]
fn pdf_clean_text_legacy(value: &str) -> String {
    value
        .chars()
        .map(|character| match character {
            'á' | 'à' | 'ã' | 'â' | 'ä' | 'Á' | 'À' | 'Ã' | 'Â' | 'Ä' => 'a',
            'é' | 'è' | 'ê' | 'ë' | 'É' | 'È' | 'Ê' | 'Ë' => 'e',
            'í' | 'ì' | 'î' | 'ï' | 'Í' | 'Ì' | 'Î' | 'Ï' => 'i',
            'ó' | 'ò' | 'õ' | 'ô' | 'ö' | 'Ó' | 'Ò' | 'Õ' | 'Ô' | 'Ö' => 'o',
            'ú' | 'ù' | 'û' | 'ü' | 'Ú' | 'Ù' | 'Û' | 'Ü' => 'u',
            'ç' | 'Ç' => 'c',
            'ñ' | 'Ñ' => 'n',
            '–' | '—' | '•' | '√' => '-',
            '“' | '”' => '"',
            '‘' | '’' => '\'',
            '\n' | '\r' | '\t' => ' ',
            value if value.is_ascii() => value,
            _ => ' ',
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<&str>>()
        .join(" ")
}

fn escape_pdf_text(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('(', "\\(")
        .replace(')', "\\)")
}
