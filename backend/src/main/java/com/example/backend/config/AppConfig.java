package com.example.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import okhttp3.OkHttpClient;

import java.util.concurrent.TimeUnit;

@Configuration
public class AppConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOrigins("*")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*");
    }

    @Bean
    public OkHttpClient okHttpClient() {
        // Configure timeouts as needed
        return new OkHttpClient.Builder()
                .connectTimeout(10, TimeUnit.SECONDS) // Timeout for establishing connection
                .writeTimeout(10, TimeUnit.SECONDS)   // Timeout for writing request data
                .readTimeout(60, TimeUnit.SECONDS)    // Timeout for reading response data (adjust for long streams)
                .build();
    }
}
