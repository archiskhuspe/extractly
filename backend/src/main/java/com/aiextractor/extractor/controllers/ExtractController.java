package com.aiextractor.extractor.controllers;

import com.aiextractor.extractor.models.SummaryResponse;
import com.aiextractor.extractor.services.HtmlExtractorService;
import com.aiextractor.extractor.services.SummarizationService;
import com.aiextractor.extractor.models.ExtractedContent;
import com.aiextractor.extractor.models.ExtractedContentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.net.MalformedURLException;
import java.net.URL;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

/**
 * REST controller for content extraction and summarization API.
 */
@RestController
@RequestMapping("/api")
public class ExtractController {
    @Autowired
    private HtmlExtractorService htmlExtractorService;
    @Autowired
    private SummarizationService summarizationService;
    @Autowired
    private ExtractedContentRepository extractedContentRepository;

    /**
     * POST /api/extract
     * Input: { url: string }
     * Output: { summary: string, keyPoints: [string, ...] }
     * Also saves the extracted content to the database.
     */
    @PostMapping("/extract")
    public ResponseEntity<?> extractContent(@RequestBody Map<String, String> body) {
        String url = body.get("url");
        if (url == null || !isValidHttpUrl(url)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Invalid or missing URL. Must start with http:// or https://"));
        }
        try {
            String text = htmlExtractorService.extractMainContent(url);
            if (text == null || text.isBlank()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "No extractable content found on the page."));
            }
            // Save extracted content to DB
            ExtractedContent entity = new ExtractedContent();
            entity.setUrl(url);
            entity.setContent(text);
            extractedContentRepository.save(entity);
            Map<String, Object> summaryResult = summarizationService.summarize(text, 5);
            String summary = (String) summaryResult.get("summary");
            List<String> keyPoints = (List<String>) summaryResult.get("keyPoints");
            entity.setSummary(summary);
            extractedContentRepository.save(entity);
            return ResponseEntity.ok(new SummaryResponse(summary, keyPoints));
        } catch (MalformedURLException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Malformed URL."));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("error", "Failed to fetch or parse the page. It may be unavailable or JavaScript-heavy."));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Unexpected error: " + e.getMessage()));
        }
    }

    /**
     * GET /api/extracted
     * Returns paginated and searchable extracted content from the database.
     * Query params: page (0-based), size, search
     */
    @GetMapping("/extracted")
    public ResponseEntity<Map<String, Object>> getAllExtractedContent(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String search) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("id").descending());
        Page<ExtractedContent> result;
        if (search != null && !search.isBlank()) {
            result = extractedContentRepository.findByUrlContainingIgnoreCaseOrContentContainingIgnoreCase(search, search, pageable);
        } else {
            result = extractedContentRepository.findAll(pageable);
        }
        // Map each ExtractedContent to include summary, url, id, and content
        List<Map<String, Object>> contentList = result.getContent().stream().map(item -> Map.<String, Object>of(
            "id", item.getId(),
            "url", item.getUrl(),
            "summary", item.getSummary(),
            "content", item.getContent()
        )).collect(java.util.stream.Collectors.toList());
        Map<String, Object> response = Map.of(
            "content", contentList,
            "totalElements", result.getTotalElements(),
            "totalPages", result.getTotalPages(),
            "page", result.getNumber(),
            "size", result.getSize()
        );
        return ResponseEntity.ok(response);
    }

    /**
     * PUT /api/extracted/{id}
     * Edit extracted content (url and content fields).
     */
    @PutMapping("/extracted/{id}")
    public ResponseEntity<?> updateExtractedContent(@PathVariable Long id, @RequestBody Map<String, String> body) {
        var entityOpt = extractedContentRepository.findById(id);
        if (entityOpt.isPresent()) {
            var entity = entityOpt.get();
            if (body.containsKey("url")) entity.setUrl(body.get("url"));
            if (body.containsKey("content")) entity.setContent(body.get("content"));
            if (body.containsKey("summary")) entity.setSummary(body.get("summary"));
            extractedContentRepository.save(entity);
            return ResponseEntity.ok(entity);
        } else {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Not found"));
        }
    }

    /**
     * DELETE /api/extracted/{id}
     * Delete extracted content by id.
     */
    @DeleteMapping("/extracted/{id}")
    public ResponseEntity<?> deleteExtractedContent(@PathVariable Long id) {
        if (!extractedContentRepository.existsById(id)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Not found"));
        }
        extractedContentRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Deleted"));
    }

    // Helper: Validate HTTP/S URL
    private boolean isValidHttpUrl(String url) {
        try {
            URL u = new URL(url);
            return u.getProtocol().equals("http") || u.getProtocol().equals("https");
        } catch (Exception e) {
            return false;
        }
    }
} 
