from app.normalise_am import fold, normalise_question, tokens


def test_homophone_families_fold_by_offset():
    # ሐ/ኀ families -> ሀ, ሠ -> ሰ, ዐ -> አ, ፀ -> ጸ ; each family is 8 code points
    for src, dst in [(0x1210, 0x1200), (0x1280, 0x1200), (0x1220, 0x1230), (0x12D0, 0x12A0), (0x1340, 0x1338)]:
        for i in range(8):
            assert fold(chr(src + i)) == chr(dst + i)


def test_spelling_variants_match():
    assert tokens("ሥራ") == tokens("ስራ")          # "work", two common spellings
    assert tokens("ፀሐይ") == tokens("ጸሀይ")
    assert tokens("ዐማርኛ") == tokens("አማርኛ")


def test_ethiopic_punctuation_splits():
    assert tokens("ሰላም።ጤና፡ይስጥልኝ፣ደህና") == ["ሰላም", "ጤና", "ይስጥልኝ", "ደህና"]


def test_english_lowercase_and_punctuation():
    assert tokens("Where do I FINISH this lesson?!") == ["finish", "lesson"]


def test_question_log_strips_personal_details():
    q = normalise_question("call me on 0911 234 567 or mail abc@example.com about portfolio")
    assert "0911" not in q and "example" not in q and "portfolio" in q
