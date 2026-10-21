package online.techlyn.inkpost_api.frame;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import online.techlyn.inkpost_api.display.MonoBitmap;

/** One picture for the display: the smallest unit the schedule shows. */
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Frame {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Integer id;

	@Setter
	@Column(nullable = false)
	private String name;

	/** {@link MonoBitmap#SIZE_BYTES} bytes, packed by {@link MonoBitmap} (D4). */
	@Setter
	@Column(nullable = false)
	private byte[] bitmap;

	@Column(nullable = false, updatable = false)
	private LocalDateTime createdAt;

	public Frame(String name, byte[] bitmap, LocalDateTime createdAt) {
		this.name = name;
		this.bitmap = bitmap;
		this.createdAt = createdAt;
	}
}
