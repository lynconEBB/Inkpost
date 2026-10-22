plugins {
	java
	id("org.springframework.boot") version "4.1.1"
	id("io.spring.dependency-management") version "1.1.7"
}

group = "online.techlyn"
version = "0.0.1-SNAPSHOT"

java {
	toolchain {
		languageVersion = JavaLanguageVersion.of(27)
	}
}

// Boot's managed Lombok (1.18.46) fails on JDK 27; 1.18.48 supports it.
extra["lombok.version"] = "1.18.48"

repositories {
	mavenCentral()
}

dependencies {
	implementation("org.springframework.boot:spring-boot-starter-actuator")
	implementation("org.springframework.boot:spring-boot-starter-data-jpa")
	implementation("org.springframework.boot:spring-boot-starter-flyway")
	implementation("org.springframework.boot:spring-boot-starter-thymeleaf")
	implementation("org.springframework.boot:spring-boot-starter-validation")
	implementation("org.springframework.boot:spring-boot-starter-webmvc")
	implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:3.1.1")
	runtimeOnly("org.xerial:sqlite-jdbc")
	runtimeOnly("org.hibernate.orm:hibernate-community-dialects")
	compileOnly("org.projectlombok:lombok")
	developmentOnly("org.springframework.boot:spring-boot-devtools")
	annotationProcessor("org.projectlombok:lombok")
	testImplementation("org.springframework.boot:spring-boot-starter-data-jpa-test")
	testImplementation("org.springframework.boot:spring-boot-starter-thymeleaf-test")
	testImplementation("org.springframework.boot:spring-boot-starter-webmvc-test")
	testCompileOnly("org.projectlombok:lombok")
	testRuntimeOnly("org.junit.platform:junit-platform-launcher")
	testAnnotationProcessor("org.projectlombok:lombok")
}

// sqlite-jdbc loads a native library; without this, Java warns that it will be blocked (JEP 472).
val enableNativeAccess = "--enable-native-access=ALL-UNNAMED"

tasks.withType<Test> {
	useJUnitPlatform()
	jvmArgs(enableNativeAccess)
}

// The web UI's DOM-free JS modules (D42), on Node's own test runner; Node is pinned in mise.toml.
val jsTest by tasks.registering(Exec::class) {
	group = LifecycleBasePlugin.VERIFICATION_GROUP
	description = "Runs the JS tests in src/test/js with node --test."
	// Node expands the glob itself; it doesn't search a directory.
	commandLine("node", "--test", "src/test/js/**/*.test.js")
}

tasks.check {
	dependsOn(jsTest)
}

tasks.bootRun {
	jvmArgs(enableNativeAccess)
}

tasks.bootJar {
	manifest {
		attributes("Enable-Native-Access" to "ALL-UNNAMED")
	}
}
