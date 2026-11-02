package it.myri.auth;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import it.myri.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;

class AuthenticationTest extends IntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired AppUserRepository users;
    @Autowired AccountService accounts;

    @Test
    void passwordResetRevokesPreviouslyAuthenticatedSessions() throws Exception {
        MockHttpSession session = new MockHttpSession();
        mvc.perform(post("/api/v1/auth/login").session(session).with(csrf())
                .param("username", "owner").param("password", "fictitious-test-password"))
                .andExpect(status().isNoContent());
        accounts.reset("fictitious-test-password");
        mvc.perform(get("/api/v1/auth/me").session(session)).andExpect(status().isUnauthorized());
        assertTrue(session.isInvalid());
        mvc.perform(post("/api/v1/auth/login").with(csrf())
                .param("username", "owner").param("password", "fictitious-test-password"))
                .andExpect(status().isNoContent());
    }

    @Test
    void protectedApisAndOpenApiNeverRedirectToHtml() throws Exception {
        mvc.perform(get("/api/v1/auth/me")).andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
        mvc.perform(get("/v3/api-docs")).andExpect(status().isUnauthorized());
        mvc.perform(get("/health")).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void loginRequiresCsrfAndPasswordAndLogoutInvalidatesSession() throws Exception {
        mvc.perform(post("/api/v1/auth/login").param("username", "owner")
                .param("password", "fictitious-test-password")).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/auth/login").with(csrf()).param("username", "owner")
                .param("password", "wrong-password")).andExpect(status().isUnauthorized());
        MockHttpSession session = new MockHttpSession();
        String oldId = session.getId();
        mvc.perform(post("/api/v1/auth/login").session(session).with(csrf())
                .param("username", "owner").param("password", "fictitious-test-password"))
                .andExpect(status().isNoContent());
        assertNotEquals(oldId, session.getId());
        mvc.perform(get("/api/v1/auth/me").session(session)).andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("owner"))
                .andExpect(jsonPath("$.passwordHash").doesNotExist());
        var auth = (org.springframework.security.core.context.SecurityContext)
                session.getAttribute("SPRING_SECURITY_CONTEXT");
        assertNull(((AccountPrincipal) auth.getAuthentication().getPrincipal()).getPassword());
        mvc.perform(post("/api/v1/auth/logout").session(session).with(csrf()))
                .andExpect(status().isNoContent());
        assertTrue(session.isInvalid());
    }

    @Test
    void csrfEndpointSupportsBrowserRoundTripWithoutTestHelpers() throws Exception {
        var result = mvc.perform(get("/api/v1/auth/csrf")).andExpect(status().isOk()).andReturn();
        var token = json.readTree(result.getResponse().getContentAsString());
        var session = (MockHttpSession) result.getRequest().getSession(false);
        assertNotNull(session);
        mvc.perform(post("/api/v1/auth/login").session(session)
                .header(token.get("headerName").asText(), token.get("token").asText())
                .param("username", "owner").param("password", "fictitious-test-password"))
                .andExpect(status().isNoContent());
        var fresh = mvc.perform(get("/api/v1/auth/csrf").session(session)).andReturn();
        var freshToken = json.readTree(fresh.getResponse().getContentAsString());
        mvc.perform(post("/api/v1/auth/logout").session(session)
                .header(freshToken.get("headerName").asText(), freshToken.get("token").asText()))
                .andExpect(status().isNoContent());
    }
}
